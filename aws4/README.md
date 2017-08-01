# aws4

__Note__: This is not fully tested for all types of AWS services, or endpoints. If you run into any errors or have any questions, please open an issue or help us fix it with a PR!

This is a port of [mhart/aws4](https://github.com/mhart/aws4) Node.js library for signing and preparing requests using AWS Signature Version 4. It replaces some of the Node.js specific functions with vanilla JavaScript, so it can be added to Runscope as a [custom library](https://www.runscope.com/docs/api-testing/scripts/custom-libraries), and used in [pre-request scripts](https://www.runscope.com/docs/api-testing/scripts/pre-request).

An example pre-request script using this library:

```js
// GET http://s3.amazonaws.com

var opts = {service: 's3', path: request.path};
var awsObj = aws4.sign(opts, {accessKeyId: variables.get("AWS_ACCESS_KEY_ID"), secretAccessKey: variables.get("AWS_SECRET_ACCESS_KEY")});

for (var header in awsObj.headers) {
    request.headers[header] = awsObj.headers[header];
}
```

- [Usage](#usage)
  - [1. Adding aws4.js as a custom library to your Runscope account](#1-adding-aws4js-as-a-custom-library-to-your-runscope-account)
  - [2. Activating library in your test's environment settings](#2-activating-library-in-your-tests-environment-settings)
  - [3. Editing the test step pre-request script](#3-editing-the-test-step-pre-request-script)
- [Examples](#pre-request-scripts-examples)
  - [S3 - GET Bucket](#s3---get-bucket)
  - [S3 - GET Bucket with querystring](#s3---get-bucket-with-querystring)
  - [S3 - GET Object](#s3---get-object)
  - [S3 - PUT Object](#cloudwatch---setalarmstate)
  - [Cloudwatch - SetAlarmState](#s3---put-object)
- [Sample Runscope Test](#sample-runscope-test)

## Usage

There are 3 steps you need to follow to use this library:

1. Download the aws4.js file and upload it as a custom library to your Runscope account
2. Activate the library in your test's environment settings
3. Edit the pre-request script of your test to sign your request and add the necessary headers to it

### 1. Adding aws4.js as a custom library to your Runscope account

First, download the [aws4.js](./aws4.js) file to your computer. Next, go to your Runscope account, click on your account's profile on the top-right and select "Script Library":

![Runscope dashboard showing the account dropdown with the "Script Library" option highlighted](./screenshots/1-runscope-script-link.png?raw=true)

Then, next to the "Upload A Library" section, click on "Choose File", select the aws4.js file you previously downloaded, and then click on "Upload Script". You should see the new library in the "Existing Libraries" section, next to any other custom libraries you have previously uploaded:

![Runscope script library page showing the "Existing Libraries" section with the aws4.js library highlighted](./screenshots/2-runscope-script-library.png?raw=true)

### 2. Activating library in your test's environment settings

Next, create a new test, or go to an existing test where you want to add a test step to one of AWS APIs and click on "Edit". Open your environment settings, and select "Script Libraries" on the left-hand side menu. You should see a list of all custom script libraries in your account, including the one we just uploaded. Toggle the aws4.js library on:

![Runscope API test edit page showing the environment settings, with the "Script Libraries" option selected on the left-hand side menu, and the aws4.js library toggled on](./screenshots/3-runscope-environment-library.png?raw=true)

### 3. Editing the test step pre-request script

Now we need to open the test step with our request to an AWS API, and edit its pre-request script.

The usage of the library is the same as the one found in the original library's mhart/aws4 README.

First you need to create an object with your request information. For example, to make a request to the [GET Bucket](http://docs.aws.amazon.com/AmazonS3/latest/API/v2-RESTBucketGET.html) endpoint:

`s3.amazonaws.com/{bucketName}`

You would use the following pre-request script:

```
var opts = {service: 's3', path: request.path};
var awsObj = aws4.sign(opts, {accessKeyId: variables.get("AWS_ACCESS_KEY_ID"), secretAccessKey: variables.get("AWS_SECRET_ACCESS_KEY")});

for (var header in awsObj.headers) {
    request.headers[header] = awsObj.headers[header];
}
```

## Pre-request Scripts Examples

To use the scripts, make sure you have two variables in your environment's "Initial Variables": `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, with your AWS account's access key id and secret access key respectively.

### S3 - GET Bucket

`GET http://s3.amazonaws.com`

```js
var opts = {service: 's3', path: request.path};
var awsObj = aws4.sign(opts, {accessKeyId: variables.get("AWS_ACCESS_KEY_ID"), secretAccessKey: variables.get("AWS_SECRET_ACCESS_KEY")});

for (var header in awsObj.headers) {
    request.headers[header] = awsObj.headers[header];
}
```

### S3 - GET Bucket with querystring

`GET http://s3.amazonaws.com/hitchikers-guide-to-the-galaxy?list-type=2&delimiter=/`

```js
var splitURL = request.url.split(/\/+/g);
var fullPath = "/"+splitURL[splitURL.length-1];

var opts = {service: 's3', path: fullPath};
var awsObj = aws4.sign(opts, {accessKeyId: variables.get("AWS_ACCESS_KEY_ID"), secretAccessKey: variables.get("AWS_SECRET_ACCESS_KEY")});

for (var header in awsObj.headers) {
    request.headers[header] = awsObj.headers[header];
}
```

### S3 - GET Object

`GET http://s3.amazonaws.com/hitchikers-guide-to-the-galaxy/dont-panic.txt`

```js
var opts = {service: 's3', path: request.path};
var awsObj = aws4.sign(opts, {accessKeyId: variables.get("AWS_ACCESS_KEY_ID"), secretAccessKey: variables.get("AWS_SECRET_ACCESS_KEY")});

for (var header in awsObj.headers) {
    request.headers[header] = awsObj.headers[header];
}
```

### S3 - PUT Object

`PUT http://s3.amazonaws.com/hitchikers-guide-to-the-galaxy/file.txt`

Select "+Add Body" and add `Test Body`.

```js
var opts = {service: 's3', path: request.path, method: request.method, body: request.body};
var awsObj = aws4.sign(opts, {accessKeyId: variables.get("AWS_ACCESS_KEY_ID"), secretAccessKey: variables.get("AWS_SECRET_ACCESS_KEY")});

for (var header in awsObj.headers) {
    request.headers[header] = awsObj.headers[header];
}
```

### Cloudwatch - SetAlarmState
```
// Build the path from the query strings defined in the test (library could probably do this)
// API docs for Cloudwatch: http://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/Welcome.html

/*
    Required params for SetAlarmState is:
    * AlarmName
    * StateReason
    * StateValue
    * Action (The operation name from the API docs, in this case SetAlarmState)
    * Version (The API version to use. Defaults to an old version, so check the doc link for an appropriate version string. Note: The SetAlarmState action is not defined in the default API version.)
*/

var path = '/?';
for (var key in request.params) {
    path += request.params[key].name + "=" + request.params[key].value + "&"; // Notice that there is currently no support for array values
}

// The service name for cloudwatch is 'monitoring'
// Change region if necessary. No region means default region
var opts = {service: 'monitoring', path: path, region: 'eu-west-1', method: request.method};
var awsObj = aws4.sign(opts, {accessKeyId: variables.get("AWS_ACCESS_KEY_ID"), secretAccessKey: variables.get("AWS_SECRET_ACCESS_KEY")});

// Paste the headers on to the request
for (var header in awsObj.headers) {
    request.headers[header] = awsObj.headers[header];
}
```

## Sample Runscope Test

You can [import](https://www.runscope.com/docs/api-testing/importing#radar-import) the [awsv4-runscope-sample.json](./awsv4-runscope-sample.json) file as a new test in one of your buckets to have the exact same requests as the examples included here. Just make sure to enable the custom library in your environment settings, include the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` variables, and include your bucket name in any GET requests before running the tests.
