var async = require('async');
var moment = require('moment');
var sanitizeHtml = require('sanitize-html');
var validator = require('validator');



var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var mail=require('../sendMail.js');
var utils=require('../utils.js');

module.exports = function(app){
  app.post('/formsubmit',checkBearerToken, function(req, res,next){
  log('/formsubmit');
  log(req.body.formId);
   log(req.body.formContent);
      var apiResult = {
        code:'200',
        message:'OK'
      };


      if (!req.body.formId || !req.body.formContent ){
        apiResult.code= '400';
        apiResult.message='Bad request';
        res.status(apiResult.code).json(apiResult);
        return;
      }


      if(typeof req.body.formId !== "string" ||  typeof req.body.formContent !== "object" ){
        apiResult.code= '400';
        apiResult.message='Bad request';
        res.status(apiResult.code).json(apiResult);
        return;
      }

      log('Receiving form. Id: ' + JSON.stringify(req.body.formId) + '. Content: ' + JSON.stringify(req.body.formContent) );


      // special handling per formId
      // FormId 1: E-Teacher MOOC proposal

      if(req.body.formId == 1){
          var language='en';
          try {
              language=req.query.lang.toLowerCase();
          } catch (e) {}

          if (language!=='en' && language!=='de' && language!=='pt' && language!=='es' && language!=='fr' && language!=='it'){
              language='en';
          }

          var form= new models.SubmittedForm();
          form._user= req.accessToken._user;
          form.formId=req.body.formId;
          form.formContent= req.body.formContent;
          form.recievedTimestamp=new Date();
          form.markModified('formContent');

          form.save(function (err, theForm){
              if (err) {
                  log('Error saving Form. Error: ' + JSON.stringify(err),true);
                  apiResult.code= '500';
                  apiResult.message='Insert failed';
                  res.status(apiResult.code).json(apiResult);
                  return;
              } else {
                  // send thankyou mail
                  // depending on the kind of form (create mooc or join existing group) the text will be different
                  //
                  models.EcoUser.findOne({_id:theForm._user}).exec(function(err, theUser){
                    var thanxTranslationId=230;

                    if(theUser){
                        // add formcontent to appropriate table
                        if(form.formContent.JoinExistingGroupOrCreateNewMooc === "create"){
                            addMoocProposal(form);
                            thanxTranslationId=231;
                        } else {
                            addMoocInterestedETeacher(form);
                            thanxTranslationId=230;
                        }

                        models.Translation.findOne({id:thanxTranslationId}).exec(function(err, theTranslation){
                            if(theTranslation){
                                var textMessage = utils.getTranslation(theTranslation.toObject().translations,language);
                                // convert \r\n to <br>
                                textMessage = textMessage.replace(/<br\/>/g, "\r\n");
                                var subject= 'ECO Form submission';
                                var mailresult = mail.sendSingleTextMail('participants@ecolearning.eu', theUser.email, subject, textMessage);


                                // send formcontents to participants@ecolearning.eu
                                textMessage = "The following form has been submitted:\r\n\r\n";
                                textMessage += "User: " + theUser.email + "\r\n\r\n";
                                textMessage += "Formfields:" + "\r\n\r\n";
                                for (var property in form.formContent) {
                                    if (form.formContent.hasOwnProperty(property)) {
                                        var clean = sanitizeHtml(form.formContent[property], {
                                          allowedTags: [],
                                          allowedAttributes: {}
                                        });
                                        textMessage += property + " : " + clean + "\r\n";
                                    }
                                }
                                var mailresult = mail.sendSingleTextMail('participants@ecolearning.eu', 'participants@ecolearning.eu', subject, textMessage);

                                res.json(apiResult);
                            } else {
                              apiResult.code= '500';
                              apiResult.message='Insert failed';
                              res.status(apiResult.code).json(apiResult);
                            }
                        });
                    } else {
                        apiResult.code= '500';
                        apiResult.message='Insert failed';
                        res.status(apiResult.code).json(apiResult);
                    }
                  });
              }
          });   // form.save()

      } // formId == 1


      // FormId 2: Office 365 licence request
      if(req.body.formId == 2){
          var apiResult = {
            code:'200',
            message:'OK'
          };

          var language='en';
          try {
              language=req.body.formContent.lang.toLowerCase();
          } catch (e) {}

          if (language!=='en' && language!=='de' && language!=='pt' && language!=='es' && language!=='fr' && language!=='it'){
              language='en';
          }

          log("language:" + language);
          log("sub:" + req.body.formContent.sub);

          models.Office365AccountRequest.findOne({_user:req.body.formContent.sub}).exec(function(err, theAccount){
            if(theAccount){
                log('office365 account already created');
                var apiResult = {
                    code:'200',
                    message:'TAKEN'
                };

                models.AdvertisementsPerUser.findOne({
                        advertisementNr: 1,
                        _user: theAccount._user,
                    }, function(err, theAdvertisementPerUser){
                        if(!err){
                            if(!theAdvertisementPerUser){
                                // update view stats
                                theAdvertisementPerUser = new models.AdvertisementsPerUser;
                                theAdvertisementPerUser._user = theAccount._user;
                                theAdvertisementPerUser.advertisementNr = 1;
                                theAdvertisementPerUser.shownOn = [new Date()];
                                theAdvertisementPerUser.showPopup = false;
                            } else {
                                theAdvertisementPerUser.shownOn.push(new Date());
                                theAdvertisementPerUser.showPopup = false;
                            }

                            theAdvertisementPerUser.save();
                        }
                   }
                );

                return res.status(apiResult.code).json(apiResult);
            } else {
                models.EcoUser.findOne({_id:req.body.formContent.sub}).exec(function(err, theUser){
                    if(theUser){
                        var theAccount = new models.Office365AccountRequest();
                        theAccount._user = theUser._id;
                        theAccount.userPrincipalName = validator.whitelist(theUser.uniqueUserName, 'a-zA-Z0-9-_.');
                        theAccount.ecoEmail= theUser.emailcanonical;
                        theAccount.language= language;
                        theAccount.submittedOn= new Date();
                        theAccount.exportedOn=null;
                        theAccount.userRegisteredOn = theUser.registeredOn;
                        theAccount.save(function(err, theAccount){
                            if (err){
                                var apiResult = {
                                    code:'200',
                                    message:'ERROR'
                                }
                                return res.status(apiResult.code).json(apiResult);
                            } else {
                                log('record added');
                                var apiResult = {
                                  code:'200',
                                  message:'OK'
                                };

                                // send welcome email to user
                                models.Translation.findOne({id:261}).exec(function(err, theTranslation){
                                    var textMessage = utils.getTranslation(theTranslation.toObject().translations, theAccount.language);
                                    // convert \r\n to <br>
                                    textMessage = textMessage.replace(/<br>/g, "\r\n");

                                    models.Translation.findOne({id:265}).exec(function(err, theTranslation){
                                        var subject = utils.getTranslation(theTranslation.translations, theAccount.language);
                                        textMessage=textMessage.replace("[username]", theAccount.userPrincipalName + "@participants.ecolearning.eu");
                                        textMessage=textMessage.replace("[temporary password]", "hTsRej3g");

                                        log(textMessage,true);
                                        log(subject,true);
                                        var mailresult = mail.sendSingleTextMailBCC('participants@ecolearning.eu', theAccount.ecoEmail, 'k.loozen@reimeritsolutions.nl', subject, textMessage);
                                    });
                                });

                                models.AdvertisementsPerUser.findOne({
                                        advertisementNr: 1,
                                        _user: theUser._id,
                                    }, function(err, theAdvertisementPerUser){
                                        if(!err){
                                            if(!theAdvertisementPerUser){
                                                // update view stats
                                                theAdvertisementPerUser = new models.AdvertisementsPerUser;
                                                theAdvertisementPerUser._user = theUser._id;
                                                theAdvertisementPerUser.advertisementNr = 1;
                                                theAdvertisementPerUser.shownOn = [new Date()];
                                                theAdvertisementPerUser.showPopup = false;
                                            } else {
                                                theAdvertisementPerUser.shownOn.push(new Date());
                                                theAdvertisementPerUser.showPopup = false;
                                            }

                                            theAdvertisementPerUser.save();
                                        }
                                   }
                                );


                                return res.status(apiResult.code).json(apiResult);
                            }
                        });
                    } else {
                        log('user not found');
                        var apiResult = {
                            code:'200',
                            message:'ERROR'
                        };
                        return res.status(apiResult.code).json(apiResult);
                    }
                });
            }
        });

      }

  });  // app.post('/formsubmit'
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


function addMoocProposal(SubmittedForm) {
    // determine next  nr
    models.MoocProposal.find({}).sort({nr:-1}).exec(function(err,proposals){
        var MoocProposal = new models.MoocProposal;
        MoocProposal._user = SubmittedForm._user;
        if(proposals.length==0){
            MoocProposal.nr = 1;
        } else {
            MoocProposal.nr = proposals[0].nr+1;
        }

        MoocProposal.teacherTeachesAtEducationalLevel = SubmittedForm.formContent.AtWhatEducationalLevelDoYouTeach;
        MoocProposal.teacherTeachesWhat = SubmittedForm.formContent.WhatDoYouTeach;
        MoocProposal.teachercompletedMoocs = SubmittedForm.formContent.WhichAreYourCompletedMoocs;
        MoocProposal.teacherIsTeacher = (SubmittedForm.formContent.AreYouATeacher=='yes');

        MoocProposal.proposedMoocCategory = SubmittedForm.formContent.YourMoocCategory;
        MoocProposal.tentativeMoocTitle = SubmittedForm.formContent.YourTentativeMoocTitle;
        MoocProposal.proposedMoocTopic = SubmittedForm.formContent.YourMoocTopic;
        MoocProposal.proposedMoocLanguages = SubmittedForm.formContent.YourMoocLanguages;
        MoocProposal.proposedMoocLearningObjectives =  SubmittedForm.formContent.LearningObjectives;
        MoocProposal.proposedMoocDescription =  SubmittedForm.formContent.ShortDescription;
        MoocProposal.proposedMoocRecommendedRequirements =  SubmittedForm.formContent.RecommendedRequirements;
        MoocProposal.proposedMoocTargetAudience =  SubmittedForm.formContent.TargetAudience;
        MoocProposal.proposedMoocResources =  SubmittedForm.formContent.Resources;
        MoocProposal.proposedMoocCoTeachers =  SubmittedForm.formContent.CoTeachers;
        MoocProposal.proposedMoocOtherComments =  SubmittedForm.formContent.OtherComments;
        MoocProposal.moocOfferedBefore =  (SubmittedForm.formContent.MoocOfferedBeforeYesNo=='yes');
        MoocProposal.proposedMoocEducationalLevel = SubmittedForm.formContent.YourMoocEducationalLevel;

        MoocProposal.status=1;
        MoocProposal.notes = "";
        MoocProposal.assignedHub = "";
        MoocProposal.assignedHubContact=""

        MoocProposal.save();

    });
}


function addMoocInterestedETeacher(SubmittedForm) {
    // determine next  nr
    models.InterestedETeacher.find({}).sort({nr:-1}).exec(function(err,teachers){
        var InterestedETeacher = new models.InterestedETeacher;
        InterestedETeacher._user = SubmittedForm._user;

        if(teachers.length==0){
            InterestedETeacher.nr = 1;
        } else {
            InterestedETeacher.nr = teachers[0].nr+1;
        }

        InterestedETeacher.teacherTeachesAtEducationalLevel = SubmittedForm.formContent.AtWhatEducationalLevelDoYouTeach;
        InterestedETeacher.teacherTeachesWhat = SubmittedForm.formContent.WhatDoYouTeach;
        InterestedETeacher.teachercompletedMoocs = SubmittedForm.formContent.WhichAreYourCompletedMoocs;
        InterestedETeacher.teacherIsTeacher = (SubmittedForm.formContent.AreYouATeacher=='yes');

        InterestedETeacher.status=1;
        InterestedETeacher.notes = "";
        InterestedETeacher.assignedHub = "";
        InterestedETeacher.assignedHubContact=""

        InterestedETeacher.save();
    });
}

