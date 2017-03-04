var async = require('async');
var moment = require('moment');
var sanitizeHtml = require('sanitize-html');


var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');


module.exports = function(app){
  // accepts an xApi statement transmitted from the ECO IDP and puts it in the queue
  app.post('/xapiidp', function(req, res,next){

      try {
        log('Receiving xApi statement. Actor: ' + JSON.stringify(req.body.actor) + '. Verb: ' + JSON.stringify(req.body.verb) + '. Object: ' + JSON.stringify(req.body.object) + '. context: ' + JSON.stringify(req.body.context) );
      } catch (e) {}


      var apiResult = {
        code:'200',
        message:'OK'
      };

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

      // context is optional
      if (req.body.context && (typeof req.body.context !== "object" || !req.body.context.id)){
        apiResult.code= '400';
        apiResult.message='Bad request';
        res.status(apiResult.code).json(apiResult);
        return;
      }



      if (req.body.verb === "https://brindlewaye.com/xAPITerms/verbs/loggedin"){
        var actor = {
            "objectType": "Agent",
            "account": {
                "homePage": "https://portal.ecolearning.eu?user="+ req.body.actor,
                "name": req.body.actor
            }
        }
        var verb= {
            "id": "https://brindlewaye.com/xAPITerms/verbs/loggedin",
            "display": {
                "en-US": "Indicates the learner logged in at ECO IDP"
            }
        }

        var object= {
            "objectType": "Activity",
            "id": "http://EcoIDPLogin",
            "definition": {
                "name": {
                     "en-US": "IDP login screen"
                },
                "description": {
                    "en-US": "This is the page where users can log in"
                },
                "type": "http://activitystrea.ms/schema/1.0/page"
            }
        }

        // lookup IDP client
        models.OpenIDClient.findOne({_id:req.body.context.id}).exec(function(err,theClient){
            if (err){
              apiResult.code= '500';
              apiResult.message='Insert failed: Unknown IDP Client';
              res.status(apiResult.code).json(apiResult);
              return;
            }

            var context= {
                "contextActivities": {
                    "parent": {
                        "id": theClient.key,
                        "objectType": "Activity",
                        "definition": {
                            "name": {
                                "en-US": theClient.public_AppName
                            },
                            "description": {
                                "en-US": "The IDP client  that initiated the request."
                            },
                            "type": "http://www.ecolearning.eu/expapi/idpclient"
                        }
                    }
                }
            }

            var XapiQueue=new models.XapiQueue();
            XapiQueue.recievedTimestamp = new Date();
            XapiQueue.committedTimestamp=null;
            XapiQueue.idpClient=null;
            XapiQueue.actor= actor;
            XapiQueue.verb= verb;
            XapiQueue.object= object;
            XapiQueue.context= context;
            XapiQueue.markModified('actor');
            XapiQueue.markModified('verb');
            XapiQueue.markModified('object');
            XapiQueue.markModified('context');
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
        }) // end findOne
    }  // end if (req.body.verb === "https://brindlewaye.com/xAPITerms/verbs/loggedin"){





      if (req.body.verb === "http://activitystrea.ms/schema/1.0/starts"){
        var actor = {
            "objectType": "Agent",
            "account": {
                "homePage": "https://portal.ecolearning.eu?user=unknown",
                "name": "unknown"
            }
        }
        var verb= {
            "id": "http://activitystrea.ms/schema/1.0/starts",
            "display": {
                "en-US": "Indicates the learner started the ECO registration"
            }
        }

        var object= {
            "objectType": "Activity",
            "id": "https://idp.ecolearning.eu/register",
            "definition": {
                "name": {
                     "en-US": "ECO registration page"
                },
                "description": {
                    "en-US": "This the page where users can register"
                },
                "type": "http://activitystrea.ms/schema/1.0/page"
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
      }  // end if (req.body.verb === "http://activitystrea.ms/schema/1.0/starts"){



      if (req.body.verb === "http://adlnet.gov/expapi/verbs/registered"){
        var actor = {
            "objectType": "Agent",
            "account": {
                "homePage": "https://portal.ecolearning.eu?user="+ req.body.actor,
                "name": req.body.actor
            }
        }
        var verb= {
            "id": "http://adlnet.gov/expapi/verbs/registered",
            "display": {
                "en-US": "Indicates the learner completes the ECO registration"
            }
        }

        var object= {
            "objectType": "Activity",
            "id": "https://idp.ecolearning.eu/register",
            "definition": {
                "name": {
                     "en-US": "ECO registration page"
                },
                "description": {
                    "en-US": "This the page where users can register"
                },
                "type": "http://activitystrea.ms/schema/1.0/page"
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
      }  // end if (req.body.verb === "http://adlnet.gov/expapi/verbs/registered"){





      if (req.body.verb === "http://activitystrea.ms/schema/1.0/confirm"){
        var actor = {
            "objectType": "Agent",
            "account": {
                "homePage": "https://portal.ecolearning.eu?user="+ req.body.actor,
                "name": req.body.actor
            }
        }
        var verb= {
            "id": "http://activitystrea.ms/schema/1.0/confirm",
            "display": {
                "en-US": "Indicates the learner activates his ECO account"
            }
        }

        var object= {
            "objectType": "Activity",
            "id": "https://idp.ecolearning.eu/register",
            "definition": {
                "name": {
                     "en-US": "ECO registration page"
                },
                "description": {
                    "en-US": "This the page where users can register"
                },
                "type": "http://activitystrea.ms/schema/1.0/page"
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
      }  // end if (req.body.verb === "http://activitystrea.ms/schema/1.0/confirm"){



  });
}

