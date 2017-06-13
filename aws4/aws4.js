/* Helper Functions */

function byteLength(str) {
  var s = str.length;
  for (var i = str.length-1; i >= 0; i--) {
    var code = str.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) s++;
    else if (code > 0x7ff && code <= 0xffff) s += 2;
    if (code >= 0xDC00 && code <= 0xDFFF) i--;
  }
  return s;
}

function urlParse(url) {
    var match = url.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);
    return match && {
        href: url,
        protocol: match[1],
        host: match[2],
        hostname: match[3],
        port: match[4],
        pathname: match[5],
        search: match[6],
        hash: match[7]
    };
}

function parseQuery(str) {
  if (typeof str != "string" || str.length == 0) return {};
  var s = str.split("&");
  var bit, query = {}, first, second;
  for (var i = 0; i < s.length; i++) {
    bit = s[i].split("=");
    first = decodeURIComponent(bit[0]);
    if(first.length == 0) continue;
    second = decodeURIComponent(bit[1]);
    if (typeof query[first] == "undefined") query[first] = second;
    else if (query[first] instanceof Array) query[first].push(second);
    else query[first] = [query[first], second];
  }
  return query;
}

function serialize(obj) {
  var str = [];
  for (var p in obj)
    if (obj.hasOwnProperty(p)) {
    	if (obj[p] instanceof Array) {
      	for (var q in obj[p]) {
        	str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p][q]));
        }
      } else {
	      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
      }
    }
  return str.join("&");
}

/* Lru File */
// source: https://github.com/mhart/aws4/blob/master/lru.js

function LruCache(size) {
  this.capacity = size | 0;
  this.map = Object.create(null);
  this.list = new DoublyLinkedList();
}

LruCache.prototype.get = function(key) {
  var node = this.map[key];
  if (node == null) return undefined;
  this.used(node);
  return node.val;
};

LruCache.prototype.set = function(key, val) {
  var node = this.map[key];
  if (node != null) {
    node.val = val;
  } else {
    if (!this.capacity) this.prune();
    if (!this.capacity) return false;
    node = new DoublyLinkedNode(key, val);
    this.map[key] = node;
    this.capacity--;
  }
  this.used(node);
  return true;
};

LruCache.prototype.used = function(node) {
  this.list.moveToFront(node);
};

LruCache.prototype.prune = function() {
  var node = this.list.pop();
  if (node != null) {
    delete this.map[node.key];
    this.capacity++;
  }
};


function DoublyLinkedList() {
  this.firstNode = null;
  this.lastNode = null;
}

DoublyLinkedList.prototype.moveToFront = function(node) {
  if (this.firstNode == node) return;

  this.remove(node);

  if (this.firstNode == null) {
    this.firstNode = node;
    this.lastNode = node;
    node.prev = null;
    node.next = null;
  } else {
    node.prev = null;
    node.next = this.firstNode;
    node.next.prev = node;
    this.firstNode = node;
  }
};

DoublyLinkedList.prototype.pop = function() {
  var lastNode = this.lastNode;
  if (lastNode != null) {
    this.remove(lastNode);
  }
  return lastNode;
};

DoublyLinkedList.prototype.remove = function(node) {
  if (this.firstNode == node) {
    this.firstNode = node.next;
  } else if (node.prev != null) {
    node.prev.next = node.next;
  }
  if (this.lastNode == node) {
    this.lastNode = node.prev;
  } else if (node.next != null) {
    node.next.prev = node.prev;
  }
};


function DoublyLinkedNode(key, val) {
  this.key = key;
  this.val = val;
  this.prev = null;
  this.next = null;
}

/* aws4.js File */
// source: https://github.com/mhart/aws4/blob/master/aws4.js

var aws4 = {};
var credentialsCache = new LruCache(1000);

// http://docs.amazonwebservices.com/general/latest/gr/signature-version-4.html

function hmac(key, string, encoding) {
  var hash = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key).update(string).finalize();
  if(encoding === "hex") {
    return hash.toString(CryptoJS.enc.Hex);
  }
  else if(encoding === "base64") {
    return hash.toString(CryptoJS.enc.Base64);
  }
  else if(encoding === "utf8") {
    return hash.toString(CryptoJS.enc.Utf8);
  }
  return hash;
}

function hash(string, encoding) {
  var sha256 = CryptoJS.algo.SHA256.create();
  sha256.update(string);
  var hash = sha256.finalize();
  if(encoding === "hex") {
    return hash.toString(CryptoJS.enc.Hex);
  }
  else if(encoding === "base64") {
    return hash.toString(CryptoJS.enc.Base64);
  }
  else if(encoding === "utf8") {
    return hash.toString(CryptoJS.enc.Utf8);
  }
  return hash;
}

// This function assumes the string has already been percent encoded
function encodeRfc3986(urlEncodedString) {
  return urlEncodedString.replace(/[!'()*]/g, function(c) {
    return "%" + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

// request: { path | body, [host], [method], [headers], [service], [region] }
// credentials: { accessKeyId, secretAccessKey, [sessionToken] }
function RequestSigner(request, credentials) {

  if (typeof request === "string") {
    request = urlParse(request);
  }

  var headers = request.headers = (request.headers || {}),
      hostParts = this.matchHost(request.hostname || request.host || headers.Host || headers.host);

  this.request = request;
  this.credentials = credentials || this.defaultCredentials();

  this.service = request.service || hostParts[0] || "";
  this.region = request.region || hostParts[1] || "us-east-1";

  // SES uses a different domain from the service name
  if (this.service === "email") this.service = "ses";

  if (!request.method && request.body)
    request.method = "POST";

  if (!headers.Host && !headers.host) {
    headers.Host = request.hostname || request.host || this.createHost();

    // If a port is specified explicitly, use it as is
    if (request.port)
      headers.Host += ":" + request.port;
  }
  if (!request.hostname && !request.host)
    request.hostname = headers.Host || headers.host;

  this.isCodeCommitGit = this.service === "codecommit" && request.method === "GIT";
}

RequestSigner.prototype.matchHost = function(host) {
  var match = (host || "").match(/([^\.]+)\.(?:([^\.]*)\.)?amazonaws\.com$/);
  var hostParts = (match || []).slice(1, 3);

  // ES's hostParts are sometimes the other way round, if the value that is expected
  // to be region equals ‘es’ switch them back
  // e.g. search-cluster-name-aaaa00aaaa0aaa0aaaaaaa0aaa.us-east-1.es.amazonaws.com
  if (hostParts[1] === "es")
    hostParts = hostParts.reverse();

  return hostParts;
}

// http://docs.aws.amazon.com/general/latest/gr/rande.html
RequestSigner.prototype.isSingleRegion = function() {
  // Special case for S3 and SimpleDB in us-east-1
  if (["s3", "sdb"].indexOf(this.service) >= 0 && this.region === "us-east-1") return true;

  return ["cloudfront", "ls", "route53", "iam", "importexport", "sts"]
    .indexOf(this.service) >= 0;
}

RequestSigner.prototype.createHost = function() {
  var region = this.isSingleRegion() ? "" :
        (this.service === "s3" && this.region !== "us-east-1" ? "-" : ".") + this.region,
      service = this.service === "ses" ? "email" : this.service;
  return service + region + ".amazonaws.com";
}

RequestSigner.prototype.prepareRequest = function() {
  this.parsePath();

  var request = this.request, headers = request.headers, query;

  if (request.signQuery) {

    this.parsedPath.query = query = this.parsedPath.query || {};

    if (this.credentials.sessionToken)
      query["X-Amz-Security-Token"] = this.credentials.sessionToken;

    if (this.service === "s3" && !query["X-Amz-Expires"])
      query["X-Amz-Expires"] = 86400;

    if (query["X-Amz-Date"])
      this.datetime = query["X-Amz-Date"];
    else
      query["X-Amz-Date"] = this.getDateTime();

    query["X-Amz-Algorithm"] = "AWS4-HMAC-SHA256";
    query["X-Amz-Credential"] = this.credentials.accessKeyId + "/" + this.credentialString();
    query["X-Amz-SignedHeaders"] = this.signedHeaders();

  } else {

    if (!request.doNotModifyHeaders && !this.isCodeCommitGit) {
      if (request.body && !headers["Content-Type"] && !headers["content-type"])
        headers["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8";

      if (request.body && !headers["Content-Length"] && !headers["content-length"])
        headers["Content-Length"] = byteLength(request.body);

      if (this.credentials.sessionToken && !headers["X-Amz-Security-Token"] && !headers["x-amz-security-token"])
        headers["X-Amz-Security-Token"] = this.credentials.sessionToken;

      if (this.service === "s3" && !headers["X-Amz-Content-Sha256"] && !headers["x-amz-content-sha256"])
        headers["X-Amz-Content-Sha256"] = hash(this.request.body || "", "hex");

      if (headers["X-Amz-Date"] || headers["x-amz-date"])
        this.datetime = headers["X-Amz-Date"] || headers["x-amz-date"];
      else
        headers["X-Amz-Date"] = this.getDateTime();
    }

    delete headers.Authorization;
    delete headers.authorization;
  }
}

RequestSigner.prototype.sign = function() {
  if (!this.parsedPath) this.prepareRequest();

  if (this.request.signQuery) {
    this.parsedPath.query["X-Amz-Signature"] = this.signature();
  } else {
    this.request.headers.Authorization = this.authHeader();
  }

  this.request.path = this.formatPath();

  return this.request;
}

RequestSigner.prototype.getDateTime = function() {
  if (!this.datetime) {
    var headers = this.request.headers,
      date = new Date(headers.Date || headers.date || new Date);

    this.datetime = date.toISOString().replace(/[:\-]|\.\d{3}/g, "");

    // Remove the trailing 'Z' on the timestamp string for CodeCommit git access
    if (this.isCodeCommitGit) this.datetime = this.datetime.slice(0, -1);
  }
  return this.datetime;
}

RequestSigner.prototype.getDate = function() {
  return this.getDateTime().substr(0, 8);
}

RequestSigner.prototype.authHeader = function() {
  return [
    "AWS4-HMAC-SHA256 Credential=" + this.credentials.accessKeyId + "/" + this.credentialString(),
    "SignedHeaders=" + this.signedHeaders(),
    "Signature=" + this.signature(),
  ].join(", ");
}

RequestSigner.prototype.signature = function() {
  var date = this.getDate(),
      cacheKey = [this.credentials.secretAccessKey, date, this.region, this.service].join(),
      kDate, kRegion, kService, kCredentials = credentialsCache.get(cacheKey)
  if (!kCredentials) {
    kDate = hmac("AWS4" + this.credentials.secretAccessKey, date)
    kRegion = hmac(kDate, this.region)
    kService = hmac(kRegion, this.service)
    kCredentials = hmac(kService, "aws4_request")
    credentialsCache.set(cacheKey, kCredentials)
  }
  var signature = hmac(kCredentials, this.stringToSign(), "hex")
  return signature;
}

RequestSigner.prototype.stringToSign = function() {
  var stringToSign = [
    "AWS4-HMAC-SHA256",
    this.getDateTime(),
    this.credentialString(),
    hash(this.canonicalString(), "hex"),
  ].join("\n");
  return stringToSign;
}

RequestSigner.prototype.canonicalString = function() {
  if (!this.parsedPath) this.prepareRequest();

  var pathStr = this.parsedPath.path,
      query = this.parsedPath.query,
      headers = this.request.headers,
      queryStr = "",
      normalizePath = this.service !== "s3",
      decodePath = this.service === "s3" || this.request.doNotEncodePath,
      decodeSlashesInPath = this.service === "s3",
      firstValOnly = this.service === "s3",
      bodyHash;

  if (this.service === "s3" && this.request.signQuery) {
    bodyHash = "UNSIGNED-PAYLOAD";
  } else if (this.isCodeCommitGit) {
    bodyHash = "";
  } else {
    bodyHash = headers["X-Amz-Content-Sha256"] || headers["x-amz-content-sha256"] ||
      hash(this.request.body || "", "hex");
  }

  if (query) {
    queryStr = encodeRfc3986(serialize(Object.keys(query).sort().reduce(function(obj, key) {
      if (!key) return obj;
      obj[key] = !Array.isArray(query[key]) ? query[key] :
        (firstValOnly ? query[key][0] : query[key].slice().sort());
      return obj;
    }, {})))
  }
  if (pathStr !== "/") {
    if (normalizePath) pathStr = pathStr.replace(/\/{2,}/g, "/");
    pathStr = pathStr.split("/").reduce(function(path, piece) {
      if (normalizePath && piece === "..") {
        path.pop();
      } else if (!normalizePath || piece !== ".") {
        if (decodePath) piece = decodeURIComponent(piece);
        path.push(encodeRfc3986(encodeURIComponent(piece)));
      }
      return path;
    }, []).join("/")
    if (pathStr[0] !== "/") pathStr = "/" + pathStr;
    if (decodeSlashesInPath) pathStr = pathStr.replace(/%2F/g, "/");
  }

  var canonicalString = [
    this.request.method || "GET",
    pathStr,
    queryStr,
    this.canonicalHeaders() + "\n",
    this.signedHeaders(),
    bodyHash,
  ].join("\n");
  return canonicalString;
}

RequestSigner.prototype.canonicalHeaders = function() {
  var headers = this.request.headers;
  function trimAll(header) {
    return header.toString().trim().replace(/\s+/g, " ");
  }
  return Object.keys(headers)
    .sort(function(a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1 })
    .map(function(key) { return key.toLowerCase() + ":" + trimAll(headers[key]) })
    .join("\n");
}

RequestSigner.prototype.signedHeaders = function() {
  return Object.keys(this.request.headers)
    .map(function(key) { return key.toLowerCase() })
    .sort()
    .join(";");
}

RequestSigner.prototype.credentialString = function() {
  return [
    this.getDate(),
    this.region,
    this.service,
    "aws4_request",
  ].join("/");
}

RequestSigner.prototype.defaultCredentials = function() {
  var env = process.env;
  return {
    accessKeyId: env.AWS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY || env.AWS_SECRET_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  };
}

RequestSigner.prototype.parsePath = function() {
  var path = this.request.path || "/",
      queryIx = path.indexOf("?"),
      query = null;

  if (queryIx >= 0) {
    query = parseQuery(path.slice(queryIx + 1));
    path = path.slice(0, queryIx);
  }

  // S3 doesn't always encode characters > 127 correctly and
  // all services don't encode characters > 255 correctly
  // So if there are non-reserved chars (and it's not already all % encoded), just encode them all
  if (/[^0-9A-Za-z!'()*\-._~%/]/.test(path)) {
    path = path.split("/").map(function(piece) {
      return encodeURIComponent(decodeURIComponent(piece));
    }).join("/");
  }

  this.parsedPath = {
    path: path,
    query: query,
  };
}

RequestSigner.prototype.formatPath = function() {
  var path = this.parsedPath.path,
      query = this.parsedPath.query;

  if (!query) return path;

  // Services don't support empty query string keys
  if (query[""] != null) delete query[""];

  return path + "?" + encodeRfc3986(serialize(query));
}

aws4.RequestSigner = RequestSigner;

aws4.sign = function(request, credentials) {
  return new RequestSigner(request, credentials).sign();
}