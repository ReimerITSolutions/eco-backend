var async = require('async');
var moment = require('moment');
var sanitizeHtml = require('sanitize-html');


var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');


module.exports = function(app){
  // accepts an xApi statement and puts it in the queue
  app.post('/xapi', checkBearerToken, function(req, res,next){
      var apiResult = {
        code:'200',
        message:'OK'
      };

      debugger;

      if (!req.body.actor || !req.body.verb || !req.body.object){
        apiResult.code= '400';
        apiResult.message='Bad request';
        res.status(apiResult.code).json(apiResult);
        return;
      }


      if(typeof req.body.actor !== "string" || typeof req.body.verb !== "string" || typeof req.body.object !== "object" || !req.body.object.id){
        apiResult.code= '400';
        apiResult.message='Bad request';
        res.status(apiResult.code).json(apiResult);
        return;
      }

      log('Receiving xApi statement. Actor: ' + JSON.stringify(req.body.actor) + '. Verb: ' + JSON.stringify(req.body.verb) + '. Object: ' + JSON.stringify(req.body.object) );

      // let's upgrade this to a correct xApi statement
      if (req.body.verb === "http://activitystrea.ms/schema/1.0/watch"){
        var actor = {
            "objectType": "Agent",
            "account": {
                "homePage": "https://portal.ecolearning.eu?user="+ req.body.actor,
                "name": req.body.actor
            }
        }
        var verb= {
            "id": "http://activitystrea.ms/schema/1.0/watch",
            "display": {
                "en-US": "Indicates the learner watched the course details at the portal"
            }
        }

        // lookup course
        models.EcoCourse.findOne({oaiPmhIdentifier:req.body.object.id}).exec(function(err,theCourse){
            if (err){
              apiResult.code= '500';
              apiResult.message='Insert failed: Unknown course';
              res.status(apiResult.code).json(apiResult);
              return;
            }

            var title = getLanguageString(theCourse.title,'en');
            var object= {
                "objectType": "Activity",
                "id": req.body.object.id,
                "definition": {
                    "name": {
                    },
                    "description": {
                    },
                    "type": "http://adlnet.gov/expapi/activities/course"
                }
            }

            object.definition.name[title.lang]=cleanUp(title.string);
            object.definition.description[title.lang]=cleanUp(title.string);

            var XapiQueue=new models.XapiQueue();
            XapiQueue.recievedTimestamp = new Date();
            XapiQueue.committedTimestamp=null;
            XapiQueue.idpClient=null;
            XapiQueue.actor= actor;
            XapiQueue.verb= verb;
            XapiQueue.object= object;
            XapiQueue.markModified('actor');
            XapiQueue.markModified('verb');
            XapiQueue.markModified('object');
            XapiQueue.save(function (err, xApi){
                if (err) {
                    log('Error saving xApi statement. Error: ' + JSON.stringify(err),true);
                    apiResult.code= '500';
                    apiResult.message='Insert failed';
                    res.status(apiResult.code).json(apiResult);
                    return;
                } else {
                    res.json(apiResult);
                }
            });
        });
      }




      if (req.body.verb === "http://adlnet.gov/expapi/verbs/launched"){
        var actor = {
            "objectType": "Agent",
            "account": {
                "homePage": "https://portal.ecolearning.eu?user="+ req.body.actor,
                "name": req.body.actor
            }
        }
        var verb= {
            "id": "http://adlnet.gov/expapi/verbs/launched",
            "display": {
                "en-US": "Indicates the learner launched a MOOC from the ECO portal"
            }
        }

        // lookup course
        models.EcoCourse.findOne({oaiPmhIdentifier:req.body.object.id}).exec(function(err,theCourse){
            if (err){
              apiResult.code= '500';
              apiResult.message='Insert failed: Unknown course';
              res.status(apiResult.code).json(apiResult);
              return;
            }

            var title = getLanguageString(theCourse.title,'en');
            var object= {
                "objectType": "Activity",
                "id": req.body.object.id,
                "definition": {
                    "name": {
                    },
                    "description": {
                    },
                    "type": "http://adlnet.gov/expapi/activities/course"
                }
            }

            object.definition.name[title.lang]=cleanUp(title.string);
            object.definition.description[title.lang]=cleanUp(title.string);

            var XapiQueue=new models.XapiQueue();
            XapiQueue.recievedTimestamp = new Date();
            XapiQueue.committedTimestamp=null;
            XapiQueue.idpClient=null;
            XapiQueue.actor= actor;
            XapiQueue.verb= verb;
            XapiQueue.object= object;
            XapiQueue.markModified('actor');
            XapiQueue.markModified('verb');
            XapiQueue.markModified('object');
            XapiQueue.save(function (err, xApi){
                if (err) {
                    log('Error saving xApi statement. Error: ' + JSON.stringify(err),true);
                    apiResult.code= '500';
                    apiResult.message='Insert failed';
                    res.status(apiResult.code).json(apiResult);
                    return;
                } else {
                    res.json(apiResult);
                }
            });
        });
      }

      if (req.body.verb === "http://activitystrea.ms/schema/1.0/update"){
        var actor = {
            "objectType": "Agent",
            "account": {
                "homePage": "https://portal.ecolearning.eu?user="+ req.body.actor,
                "name": req.body.actor
            }
        }
        var verb= {
            "id": "http://activitystrea.ms/schema/1.0/update",
            "display": {
                "en-US": "Indicates the learner updated his profile"
            }
        }

        var object= {
            "objectType": "Activity",
            "id": "https://portal.ecolearning.eu?user="+ req.body.actor,
            "definition": {
                "name": {
                     "en-US": "My profile page"
                },
                "description": {
                    "en-US": "Page detailing the user’s profile"
                },
                "type": "http://adlnet.gov/expapi/activities/profile"
            }
        }
        var XapiQueue=new models.XapiQueue();
        XapiQueue.recievedTimestamp = new Date();
        XapiQueue.committedTimestamp=null;
        XapiQueue.idpClient=null;
        XapiQueue.actor= actor;
        XapiQueue.verb= verb;
        XapiQueue.object= object;
        XapiQueue.markModified('actor');
        XapiQueue.markModified('verb');
        XapiQueue.markModified('object');
        XapiQueue.save(function (err, xApi){
            if (err) {
                log('Error saving xApi statement. Error: ' + JSON.stringify(err),true);
                apiResult.code= '500';
                apiResult.message='Insert failed';
                res.status(apiResult.code).json(apiResult);
                return;
            } else {
                res.json(apiResult);
            }
      });
    }


  });
}


function checkBearerToken(req, res, next){
    log('Enter checkBearerToken middleware: headers:'+JSON.stringify(req.headers),true);
    debugger;

    var bearerToken = getHeadersBearerToken(req);
    async.waterfall([
      function(callback) {
          models.AccessToken.findOne({token: bearerToken})
          .exec(function (err, accessToken)
              {
                  if (err || !accessToken || !accessToken._client) {
                      var errorInfo = {
                        code:'401',
                        message:'Invalid accessToken'
                      };
                      callback(errorInfo);
                  } else {
                    // check TTL
                    if(moment(accessToken.createdOn).add(accessToken.expiresIn, 'seconds').isBefore(new Date()) ){
                        var errorInfo = {
                          code:'401',
                          message:'AccessToken expired'
                        };
                        callback(errorInfo);
                    } else {
                      callback(null, accessToken.toObject())
                    }
                  }
              }
          );
      },
      function (theAccessToken, callback) {
        callback(null, theAccessToken)
      }], function(err, theAccessToken) {
          if (err){
              res.status(err.code).json(err);
          } else {
              req.accessToken = theAccessToken;
              next();
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

function getLanguageString(languageStringArray,requestedLanguage){
        if(languageStringArray && languageStringArray.length >0){
          for(var i=0;i<languageStringArray.length;i++){
              if(languageStringArray[i].language===requestedLanguage){
                  return {
                    lang: languageStringArray[i].language,
                    string: languageStringArray[i].string || ''
                  }
              }
          }
          // requested language not found. Try English
          for(var i=0;i<languageStringArray.length;i++){
              if(languageStringArray[i].language==='en'){
                  return {
                    lang: languageStringArray[i].language,
                    string: languageStringArray[i].string || ''
                  }
              }
          }
          // last resort: Give first available language
          return {
            lang: languageStringArray[0].language,
            string: languageStringArray[0].string || ''
          }

        }
}

function cleanUp(str){
  clean = sanitizeHtml(str, {
    allowedTags: [],
    allowedAttributes: {
    }
  });
  //remove rubbish characters
  clean = clean.replace(/\t/g, '');  // tabs
  clean = clean.replace(/<br.*?(\\)?>/g, '');  // <br>
  clean = clean.replace(/\r\n/g, '');
  clean = clean.replace(/\r/g, '');
  clean = clean.replace(/\n/g, '');
  return clean;
}
