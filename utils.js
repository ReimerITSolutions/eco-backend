var mongoose = require('mongoose');
var url = require('url');
var https = require('https');
var http = require('http');
var async=require('async');
var Q=require('q');
var util = require('util');

var appSettings = require('./appSettings.js');
var log = require('./log.js');
var models=require('./models.js');


module.exports = {
    getUserAllCoursesProgress:getUserAllCoursesProgress,
    updateUserAllCoursesProgress:updateUserAllCoursesProgress,
    getTranslation:getTranslation,
    urlGETRequest:urlGETRequest,
    urlPOSTRequest:urlPOSTRequest,
    checkAuth:checkAuth,
}

function updateUserAllCoursesProgress(ecoUserId){
    var deferred=Q.defer();

    getUserAllCoursesProgress(ecoUserId)
    .then(function(progress){
        //log(JSON.stringify(progress));
        async.eachSeries(progress,
          function(platformProgress,callback){
            models.UserCourseProgress.findOne({_user:ecoUserId, _platform:platformProgress.platformId}).exec(function(err,theProgress){
                if(err){
                    callback();
                } else if(theProgress){
                    // there are already results for this platform
                    if(platformProgress.response !== null){
                      // if for some reason there was no response from the platform, do NOT overwrite existing results
                      theProgress.coursesProgress = platformProgress.response;
                      theProgress.markModified('coursesProgres');
                      theProgress.lastUpdated = new Date();
                    }
                    theProgress.save(function(err,pr){
                        callback();
                    });
                } else {
                  if(platformProgress.response !== null){
                      var p = new models.UserCourseProgress({
                          _user: mongoose.Types.ObjectId(ecoUserId),
                          _platform: mongoose.Types.ObjectId(platformProgress.platformId),
                          coursesProgress : platformProgress.response,
                          lastUpdated : new Date(),
                      });
                  } else {
                      // if for some reason there was no response from the platform, create empty result array
                      var p = new models.UserCourseProgress({
                          _user: mongoose.Types.ObjectId(ecoUserId),
                          _platform: mongoose.Types.ObjectId(platformProgress.platformId),
                          coursesProgress : []
                      });
                  }
                  p.save(function(err,pr){
                      callback();
                  });
                }
            });
          },
          function(err){
            deferred.resolve();
          }
        );
    });




   return deferred.promise;
}

function getUserAllCoursesProgress(ecoUserId){
    var deferred=Q.defer();
    models.moocPlatform.find({doHarvest:true}).exec(function(err, platforms){
        async.map(platforms,function(thePlatform, callback){
            queryPlatform(thePlatform,ecoUserId)
            .then(function(result){
                var r= {
                    platformId: thePlatform._id.toHexString(),
                    response: result
                }
                callback(null,r);
            })
            .fail(function(err){
                var r= {
                    platformId: thePlatform._id.toHexString(),
                    response: null
                }
                callback(null,r);
            })
        },
        function(err,results){
            if(!results) results = [];
            deferred.resolve(results);
        });
    });
    return deferred.promise;
}

function queryPlatform(thePlatform, ecoUserId){
    var deferred=Q.defer();
    debugger;
    var theUrl = thePlatform.RESTApiUrl + '/users/'+ecoUserId+'/courses';
    //log('CourseProgress Query on ' + thePlatform.name +': ' + theUrl,true);

    urlGETRequest(theUrl, appSettings.httpRequestTimeout)
    .then(function(data){
        if(data !=''){
            response=null;
            try {
                response = JSON.parse(data);
                //log('Platform response: ' + data ,true);
                deferred.resolve(response);
            } catch(e) {
                log('CourseProgress Query Call ' + theUrl + ' returned invalid JSON response: ' + data ,true);
                //log('Call ' + theUrl + ' returned invalid JSON response',true);
                deferred.resolve(null);
            }
        } else {
            log('ERROR: CourseProgress Query received no data on ' + theUrl ,true);
            deferred.resolve(null);
        }
    })
    .fail(function(err){
          log('Error occurred CourseProgress Query calling ' + theUrl + ': ' + JSON.stringify(err),true);
          deferred.resolve(null);
    })

    return deferred.promise;
}

function getTranslation(translationArray,requestedLanguage){
    if(translationArray && translationArray.length >0){
      for(var i=0;i<translationArray.length;i++){
          if(translationArray[i].language===requestedLanguage){
              return translationArray[i].text || '';
          }
      }
      // requested language not found. Try English
      for(var i=0;i<translationArray.length;i++){
          if(translationArray[i].language==='en'){
              return translationArray[i].text || '';
          }
      }
      // last resort: Give first available language
      return translationArray[0].text || '';
    }
}

function urlGETRequest(theUrl, timeout){
    var deferred=Q.defer();

    var urlObject=url.parse(theUrl);
    if (!urlObject.protocol){
        urlObject.protocol='http:';
    }

    var options = {
        host: urlObject.hostname,
        path: urlObject.path,
        method: 'GET',
        headers: {
            accept: '*/*'
        },
        rejectUnauthorized:false, // no ssl certifcate problems, please!
    };

    var theData='';

    if(urlObject.protocol=='https:'){
        var req = https.request(options, handleHttpResult);
        req.end();
        req.setTimeout(appSettings.httpRequestTimeout, function(){
              req.abort();
        });
        req.on('error', handleHttpError);
    }

    if(urlObject.protocol=='http:'){
        var req = http.request(options, handleHttpResult);
        req.end();
        req.setTimeout(appSettings.httpRequestTimeout, function(){
              req.abort();
        });
        req.on('error', handleHttpError);
    }

    function handleHttpResult(res) {
          res.on('data', function(data) {
            if(data){
                theData += data.toString('utf8');
            }
          });

          res.on('end', function() {
            deferred.resolve(theData);
          });
    }

    function handleHttpError(e){
        if (e.code == 'ECONNRESET'){
            log("Request timed out!" + appSettings.httpRequestTimeout + "ms",true);
        } else {
            log('ERROR:' + JSON.stringify(e),true);
        }
        deferred.reject(e);
    };

    return deferred.promise;
}

function urlPOSTRequest(theUrl,postData,headers, timeout){
    var deferred=Q.defer();

    var urlObject=url.parse(theUrl);
    if (!urlObject.protocol){
        urlObject.protocol='http:';
    }

    var options = {
      host: urlObject.hostname,
      path: urlObject.path,
      method: 'POST',
      headers: {
          'User-Agent' : 'NodeJS Client',
          'Accept': '*/*',
          'Cache-Control': 'no-cache'
      },
      rejectUnauthorized:false, // no ssl certifcate problems, please!
    }

    debugger;
    for (var key in headers){
        if(headers.hasOwnProperty(key)){
            options.headers[key] = headers[key];
        }
    }

    var theData='';

    if(urlObject.protocol=='https:'){
        var req = https.request(options, handleHttpResult);
        req.end(postData, 'utf8');
        req.setTimeout(appSettings.httpRequestTimeout, function(){
              req.abort();
        });
        req.on('error', handleHttpError);
    }

    if(urlObject.protocol=='http:'){
        var req = http.request(options, handleHttpResult);
        req.end(postData, 'utf8');
        req.setTimeout(appSettings.httpRequestTimeout, function(){
              req.abort();
        });
        req.on('error', handleHttpError);
    }

    function handleHttpResult(res) {
          res.on('data', function(data) {
            if(data){
                theData += data.toString('utf8');
            }
          });

          res.on('end', function() {
            deferred.resolve(theData);
          });
    }

    function handleHttpError(e){
        if (e.code == 'ECONNRESET'){
            log("Request timed out!" + appSettings.httpRequestTimeout + "ms",true);
        } else {
            log('ERROR:' + JSON.stringify(e),true);
        }
        deferred.reject(e);
    };

    return deferred.promise;
}



function checkAuth(req, res, next){
    log('Enter checkAuth middleware: headers:'+JSON.stringify(req.headers),false);

    var bearerToken = getHeadersBearerToken(req);
    // token opzoeken
    async.waterfall([
      function(callback) {
          models.AccessToken.findOne({token: bearerToken})
          .populate('_user') 
          .exec(function (err, accessToken)
              {
                  if (err || !accessToken ) {
                      callback({});
                  } else {
                      callback(null, accessToken.toObject({virtuals : true}))
                  }
              }
          );

      },
      function (theAccessToken, callback) {
        // nog checken op TTL van het accesstoken
        callback(null, theAccessToken)
      }], function(err, theAccessToken) {
          if (err){
            var errorInfo = {
                    code:'401',
                    message:'Invalid accessToken'
                };
                return res.status(401).json(errorInfo);
          } else {
            req.accessToken = theAccessToken;
            return next();
          }
    });
}

function getHeadersBearerToken(req) {
    if (!req.headers.authorization)
        return false;
    var parts = req.headers.authorization.split(' ');
    if(parts.length != 2 || parts[0] != 'Bearer')
        return false;
    return parts[1];
}


