const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');

function replacer(key, value) {
  if (value instanceof Map) {
    const obj = { __isMap: true };
    for (const [k, v] of value.entries()) {
      obj[k] = v;
    }
    return obj;
  }
  return value;
}

function reviver(key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.__isMap || key === 'cryptoAddresses') {
      delete value.__isMap;
      return new Map(Object.entries(value));
    }
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return value;
}

function matchesFilter(doc, filter) {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, value] of Object.entries(filter)) {
    const docVal = doc[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof RegExp)) {
      if (value.$in !== undefined) {
        if (!Array.isArray(value.$in) || !value.$in.includes(docVal)) return false;
      }
      if (value.$ne !== undefined) {
        if (docVal === value.$ne) return false;
      }
      if (value.$exists !== undefined) {
        const exists = docVal !== undefined && docVal !== null;
        if (Boolean(value.$exists) !== exists) return false;
      }
    } else if (value instanceof RegExp) {
      if (!value.test(String(docVal || ''))) return false;
    } else {
      if (docVal !== value) return false;
    }
  }
  return true;
}

class LocalQuery {
  constructor(executeFn) {
    this.executeFn = executeFn;
    this.sortFn = null;
    this.limitVal = null;
  }

  sort(sortObj) {
    this.sortFn = sortObj;
    return this;
  }

  limit(limitVal) {
    this.limitVal = limitVal;
    return this;
  }

  then(resolve, reject) {
    try {
      let results = this.executeFn();
      if (Array.isArray(results) && this.sortFn) {
        results = results.slice().sort((a, b) => {
          for (const [key, order] of Object.entries(this.sortFn)) {
            const valA = a[key];
            const valB = b[key];
            if (valA < valB) return order === -1 ? 1 : -1;
            if (valA > valB) return order === -1 ? -1 : 1;
          }
          return 0;
        });
      }
      if (Array.isArray(results) && this.limitVal !== null) {
        results = results.slice(0, this.limitVal);
      }
      resolve(results);
    } catch (err) {
      if (reject) reject(err);
    }
  }

  catch(reject) {
    return this.then(r => r, reject);
  }
}

function createModel(modelName, schemaDef) {
  const filePath = path.join(dataDir, `${modelName}.json`);
  let documents = [];

  function loadFromDisk() {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw, reviver);
        if (Array.isArray(parsed)) {
          documents = parsed.map(item => new CollectionModel(item));
        }
      } catch (err) {
        console.error(`[DATABASE] Error loading local file ${filePath}:`, err);
      }
    }
  }

  function saveToDisk() {
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const tempPath = `${filePath}.tmp`;
      const content = JSON.stringify(documents, replacer, 2);
      fs.writeFileSync(tempPath, content, 'utf8');
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      console.error(`[DATABASE] Error saving local file ${filePath}:`, err);
    }
  }

  class CollectionModel {
    constructor(data = {}) {
      if (data._id) {
        this._id = data._id;
      } else {
        this._id = Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
      }

      for (const [key, fieldDef] of Object.entries(schemaDef || {})) {
        if (data[key] !== undefined) {
          if ((fieldDef && fieldDef.type === Map) || key === 'cryptoAddresses') {
            this[key] = data[key] instanceof Map ? data[key] : new Map(Object.entries(data[key] || {}));
          } else {
            this[key] = data[key];
          }
        } else if (fieldDef && fieldDef.default !== undefined) {
          const def = fieldDef.default;
          if (typeof def === 'function') {
            this[key] = def();
          } else if (Array.isArray(def)) {
            this[key] = [...def];
          } else if ((fieldDef && fieldDef.type === Map) || def instanceof Map || key === 'cryptoAddresses') {
            this[key] = new Map();
          } else if (def !== null && typeof def === 'object') {
            this[key] = { ...def };
          } else {
            this[key] = def;
          }
        }

        if (fieldDef && fieldDef.type === Date && this[key] !== null && this[key] !== undefined && !(this[key] instanceof Date)) {
          const d = new Date(this[key]);
          if (!isNaN(d.getTime())) {
            this[key] = d;
          }
        }
      }

      for (const [key, val] of Object.entries(data)) {
        if (this[key] === undefined && typeof val !== 'function') {
          this[key] = val;
        }
      }
    }

    async save() {
      const idx = documents.findIndex(d => d._id === this._id);
      if (idx !== -1) {
        documents[idx] = this;
      } else {
        documents.push(this);
      }
      saveToDisk();
      return this;
    }
  }

  CollectionModel.modelName = modelName;
  CollectionModel.schema = schemaDef;

  CollectionModel.find = function(filter = {}) {
    return new LocalQuery(() => {
      return documents.filter(doc => matchesFilter(doc, filter));
    });
  };

  CollectionModel.findOne = function(filter = {}) {
    return new LocalQuery(() => {
      return documents.find(doc => matchesFilter(doc, filter)) || null;
    });
  };

  CollectionModel.create = async function(data) {
    const doc = new CollectionModel(data);
    documents.push(doc);
    saveToDisk();
    return doc;
  };

  CollectionModel.findOneAndUpdate = async function(filter = {}, update = {}, options = {}) {
    let doc = documents.find(d => matchesFilter(d, filter));
    let isNew = false;

    if (!doc) {
      if (options.upsert) {
        doc = new CollectionModel(filter);
        isNew = true;
        if (update.$setOnInsert) {
          for (const [k, v] of Object.entries(update.$setOnInsert)) {
            doc[k] = v;
          }
        }
      } else {
        return null;
      }
    }

    const oldDoc = options.new === false ? new CollectionModel({ ...doc }) : null;

    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) {
        doc[k] = v;
      }
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        doc[k] = (Number(doc[k]) || 0) + Number(v);
      }
    }
    for (const [k, v] of Object.entries(update)) {
      if (!k.startsWith('$')) {
        doc[k] = v;
      }
    }

    for (const [key, fieldDef] of Object.entries(schemaDef || {})) {
      if (fieldDef && fieldDef.type === Date && doc[key] !== null && doc[key] !== undefined && !(doc[key] instanceof Date)) {
        const d = new Date(doc[key]);
        if (!isNaN(d.getTime())) doc[key] = d;
      }
    }

    if (isNew) {
      documents.push(doc);
    }
    saveToDisk();

    return options.new === false ? oldDoc : doc;
  };

  CollectionModel.deleteOne = async function(filter = {}) {
    const idx = documents.findIndex(doc => matchesFilter(doc, filter));
    if (idx !== -1) {
      documents.splice(idx, 1);
      saveToDisk();
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  };

  CollectionModel.deleteMany = async function(filter = {}) {
    const initialLen = documents.length;
    documents = documents.filter(doc => !matchesFilter(doc, filter));
    const deletedCount = initialLen - documents.length;
    if (deletedCount > 0) {
      saveToDisk();
    }
    return { deletedCount };
  };

  CollectionModel.countDocuments = async function(filter = {}) {
    return documents.filter(doc => matchesFilter(doc, filter)).length;
  };

  loadFromDisk();

  return CollectionModel;
}

class LocalSchema {
  constructor(def) {
    this.def = def;
  }
  index() {}
}

module.exports = {
  Schema: LocalSchema,
  connection: { readyState: 1 },
  model: function(modelName, schemaObj) {
    const def = schemaObj instanceof LocalSchema ? schemaObj.def : schemaObj;
    return createModel(modelName, def);
  }
};
