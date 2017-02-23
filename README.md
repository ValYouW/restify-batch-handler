# restify-batch-handler
`restify-batch-handler` is a request handler for the [restify](https://github.com/restify/node-restify) framework that can emaulate multiple
requests in one actual HTTP request.

## Installation
```sh
npm install restify-batch-handler
```

## Usage
When starting up your restify server just define a new `POST` endpoint to which batch request will be
sent, for example:
```js
var batchHandler = require('restify-batch-handler');
app.server.post('/batch', batchHandler());
```
Now batch request can be sent to `/batch` endpoint, the request body should contain a `requests` array, where
each element in the array MUST have `method` and `path`, which are the http method to use for this (virtual)
requests, and the requested path, for example:
```
curl -X POST -H "Content-Type: application/json" -d '{
	"requests": [
	  {
	  	"method":"GET",
		"path": "/hello?name=Resty"
	  },
	  {
	  	"method":"POST",
		"path": "/user",
		"body": "{\"username\": \"Resty\", \"pwd\":\"secret\"}"
	  }	
	]
}' "http://api.mysite.com/batch"
```
The above is like making 2 different requests to the server:
1. GET http://api.mysite.com/hello?name=Resty
1. POST http://api.mysite.com/user with body:
```json
{
	"username": "Resty",
	"pwd": "secret"
}
```

The response is object with a `responses` array where `responses[i]` is the response for `requests[i]`,
each element is an object with:
1. statusCode - The HTTP response status code for the request
1. statusMessage - A status message (corresponding to the statusCode)
1. headers - An object with response headers
1. body - The response body
   
For example:
```json
{
  "responses": [
    {
      "statusCode": 200,
      "statusMessage": "OK",
      "headers": {
        "allow": "OPTIONS",
        "content-type": "application/json",
        "content-length": 16
      },
      "body": {
        "text": "world"
      }
    },
    {
      "statusCode": 409,
      "statusMessage": "Conflict",
      "headers": {
        "content-type": "application/json",
        "content-length": 58
      },
      "body": {
        "code": "INVALID_ARGUMENT",
        "message": "email is mandatory"
      }
    }
  ]
}
```

## Options
`restify-batch-handler` method gets an optional `options` property with:
1. logger - A logger object with `trace`, `info`, `warn`, `error` methods (must not include all, will take only what exists)

For example:
```js
var batchHandler = require('restify-batch-handler');
var myLogger = {
	trace: console.log,
	error: console.error
};
app.server.post('/batch', batchHandler({logger: myLogger}));
```
