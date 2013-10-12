function HashTable() {
  var size = 0;
  var entry = {};

  this.put = function (key, value) {
    if (!this.containsKey(key)) {
      size++;
    }
    entry[key] = value;
  };

  this.get = function (key) {
    return this.containsKey(key) ? entry[key] : null;
  };

  this.remove = function (key) {
    if (this.containsKey(key) && (delete entry[key])) {
      size--;
    }
  };

  this.containsKey = function (key) {
    return entry.hasOwnProperty(key);
  };

  this.containsValue = function (value) {
    var prop;
    for (prop in entry) {
      if (entry[prop] === value) {
        return true;
      }
    }
    return false;
  };

  this.getValues = function () {
    var values = [];
    var prop;
    for (prop in entry) {
      values.push(entry[prop]);
    }
    return values;
  };

  this.keys = function () {
    var keys = [];
    var prop;
    for (prop in entry) {
      keys.push(prop);
    }
    return keys;
  };

  this.size = function () {
    return size;
  };

  this.clear = function () {
    size = 0;
    entry = {};
  };
}

module.exports = HashTable;