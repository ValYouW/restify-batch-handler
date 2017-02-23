var Errors = require('restify-errors'),
	http = require('http');

var logger = {};

function nop(){}
function setupLogger(userLogger) {
	userLogger = userLogger || {};
	['trace', 'info', 'warn', 'error'].forEach(l => {
		logger[l] = (typeof userLogger[l] === 'function') ? userLogger[l].bind(userLogger) : nop;
	});
}

function handle(req, res, next) {
	if (!Array.isArray(req.params.requests) || req.params.requests.length < 1) {
		var err = new Errors.MissingParameterError('\`requests\` parameter is mandatory');
		logger.trace('Rejecting batch request due to missing \`requests\` param, url: `%s`\nheaders: %s\nparams: %s', req.url, req.headers, req.params);
		next(err);
		return;
	}

	nextReq(req, res, 0, new Array(req.params.requests.length));
}

function nextReq(batchReq, batchRes, i, responses) {
	var requests = batchReq.params.requests;
	if (i >= requests.length) {
		batchRes.send({
			responses: responses
		});

		return;
	}

	var currReq = requests[i];
	var newReq = createMockRequest(currReq, batchReq);
	var newRes = createMockResponse(newReq, i, (reqIndex, data) => {
		responses[reqIndex] = data;
		nextReq(batchReq, batchRes, ++i, responses);
	});

	// Simulate a new request on the http server
	batchReq.socket.server.emit('request', newReq, newRes);
}

function createMockRequest(preq, batchReq) {
	var mockReq = new http.IncomingMessage();
	mockReq.method = (typeof preq.method === 'string' && preq.method) ? preq.method.toUpperCase() : 'GET';
	mockReq.url = preq.path;

	// Copy some required props from the original requests
	mockReq.httpVersion = batchReq.httpVersion;
	mockReq.httpVersionMajor = batchReq.httpVersionMajor;
	mockReq.httpVersionMinor = batchReq.httpVersionMinor;

	// Override some headers from original requests that are specific to the /batch request (headers MUST be strings)
	mockReq.headers = batchReq.headers;
	mockReq.headers['content-length'] = '0';
	mockReq.headers['transfer-encoding'] = '';

	if (typeof preq.body === 'string' && preq.body) {
		mockReq.headers['content-length'] = preq.body.length.toString();

		// IncomingMessage is ReadableStream so we override the method that is responsible for reading the data
		// to emulate the streaming of the body
		mockReq._read = function fakeReqRead() {
			mockReq.push(preq.body);
			mockReq.push(null); // Signal that no more data is expected
		};
	}

	return mockReq;
}

function createMockResponse(mockReq, reqIndex, cb) {
	var mockRes = new http.ServerResponse(mockReq);
	var origEnd = mockRes.end;
	mockRes.end = function fakeResEnd() {
		origEnd.call(mockRes);
		cb(reqIndex, {
			statusCode: this.statusCode,
			statusMessage: this.statusMessage,
			headers: this._headers,
			body: (this._body instanceof Error) && this._body.body ? this._body.body : this._body
		});
	};

	return mockRes;
}

module.exports = function(opts) {
	opts = opts || {};
	setupLogger(opts.logger);

	logger.info('Initializing batch handler, options:', opts);
	return handle;
};
