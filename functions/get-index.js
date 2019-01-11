'use strict';

// Needed to convert callback functions into async functions that return a promise
const co = require("co");
const Promise = require("bluebird");
const fs = Promise.promisifyAll(require("fs"));
const Mustache = require('mustache');
const http = require('superagent-promise')(require('superagent'), Promise);
const aws4 = require('aws4');
const URL = require('url');

const awsRegion = process.env.AWS_REGION;
const cognitoUserPoolId = process.env.cognito_user_pool_id;
const cognitoClientId =  process.env.cognito_client_id;

// Reference to Env variable set in serverless.yml
const restaurantsApiRoot = process.env.restaurants_api;
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

var html;

function* loadHtml() {
  // Take advantage of container reuse to avoid loading static content or creating 
  if (!html) {
  html = yield fs.readFileAsync('static/index.html', 'utf-8');
  }
  return html;  
}

function* getRestaurants() {
  // URL module API changed after Node 6.10 [be sure to update this when migrating to new Node version]
  let url = URL.parse(restaurantsApiRoot);
  let opts = {
    host: url.hostname,
    path: url.pathname,
  }

  aws4.sign(opts);

  return (yield http
  .get(restaurantsApiRoot)
  .set('Host', opts.headers['Host'])
  .set('X-Amz-Date', opts.headers['X-Amz-Date'])
  .set('Authorization', opts.headers['Authorization'])
  .set('X-Amz-Security-Token', opts.headers['X-Amz-Security-Token'])
  ).body;
}

module.exports.handler = co.wrap(function*(event, context, callback) {
  let template = yield loadHtml();
  let restaurants = yield getRestaurants(); 
  let dayOfWeek = days[new Date().getDay()];
  let view = {
    dayOfWeek,
    restaurants,
    awsRegion,
    cognitoUserPoolId,
    cognitoClientId,
    searchUrl: `${restaurantsApiRoot}/search`
  }
  let html = Mustache.render(template, view);

  const response = {
    statusCode: 200,
    body: html,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8'
    }
  };

  callback(null, response);
});
