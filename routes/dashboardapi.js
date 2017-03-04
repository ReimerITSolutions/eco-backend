var cors = require('cors');
var async = require('async');
var ejs = require('ejs');
var validator = require('validator');

var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var utils=require('../utils.js');
var sendMail=require('../sendMail.js');



module.exports = function(app){
  app.get('/dashboardapi/moocapplications', utils.checkAuth, checkRoles("moocitoadmin"), function(req, res,next){
  log('get /dashboardapi/moocapplications');
      var apiResult = {
        code:'200',
        message:'OK'
      };
      models.MoocProposal.find({}).sort({nr:1}).lean().exec(function(err, moocProposals){
          async.each(moocProposals, function(theMoocProposal, callback) {
              theMoocProposal.notes = theMoocProposal.notes||'';

              async.parallel([
                  function(callback){
                      models.EcoUser.findOne({_id: theMoocProposal._user}).exec(function(err,theUser){
                          if(theUser){
                              theMoocProposal._user = {
                                _id: theUser._id,
                                name:theUser.name,
                                email: theUser.emailcanonical,
                              }
                              callback(null);
                          } else {
                              theMoocProposal._user ={
                                _id: theMoocProposal._user,
                                name:'',
                                email: '',
                              }
                              callback(null);
                          }
                      });
                  },
                  function(callback){
                      models.EcoUser.findOne({emailcanonical: theMoocProposal.assignedHubContact}).exec(function(err,theUser){
                          if(theUser){
                              theMoocProposal._assignedHubContact= {
                                _id: theUser._id,
                                name:theUser.name,
                                email: theUser.emailcanonical,
                              }
                              callback(null);
                          } else {
                              theMoocProposal._assignedHubContact= {
                                _id: null,
                                name:'',
                                email: theMoocProposal.assignedHubContact,
                              }
                              callback(null);
                          }
                      });
                  }


                  ],
                  function(err,results){
                      callback(null);
                  }
              );
          },
          function(err){
              return res.json(moocProposals);
          });

      });

  });

  app.put('/dashboardapi/moocapplications', utils.checkAuth, checkRoles("moocitoadmin"), function(req, res,next){
  log('put /dashboardapi/moocapplications');
      var apiResult = {
        code:'200',
        message:'OK'
      };

      models.MoocProposal.findOne({_id:req.body.id}).exec(function(err,theMoocProposal){
         if(theMoocProposal){
            theMoocProposal.status = (req.body.status !== ''?req.body.status:theMoocProposal.status);
            theMoocProposal.assignedHub = req.body.hub;
            theMoocProposal.notes = req.body.notes;
            theMoocProposal.assignedHubContact = req.body.contact;

            theMoocProposal.save(function(err){
                if(!err){
                    return res.json(apiResult);
                } else {
                    apiResult.code= '500',
                    apiResult.message='User update failed'
                    res.status(apiResult.code).json(apiResult);
                }
            });
         } else {
            apiResult.code= '500',
            apiResult.message='User update failed'
            res.status(apiResult.code).json(apiResult);
         }
      });
  });

  app.get('/dashboardapi/interestedteachers', utils.checkAuth, checkRoles("moocitoadmin"), function(req, res,next){
  log('get /dashboardapi/interestedteachers');
      var apiResult = {
        code:'200',
        message:'OK'
      };
      models.InterestedETeacher.find({}).sort({nr:1}).lean().exec(function(err, InterestedETeachers){
          async.each(InterestedETeachers, function(theInterestedETeacher, callback) {
              theInterestedETeacher.notes = theInterestedETeacher.notes||'';

              async.parallel([
                  function(callback){
                      models.EcoUser.findOne({_id: theInterestedETeacher._user}).exec(function(err,theUser){
                          if(theUser){
                              theInterestedETeacher._user = {
                                _id: theUser._id,
                                name:theUser.name,
                                email: theUser.emailcanonical,
                              }
                              callback(null);
                          } else {
                              theInterestedETeacher._user ={
                                _id: theInterestedETeacher._user,
                                name:'',
                                email: '',
                              }
                              callback(null);
                          }
                      });
                  },
                  function(callback){
                      models.EcoUser.findOne({emailcanonical: theInterestedETeacher.assignedHubContact}).exec(function(err,theUser){
                          if(theUser){
                              theInterestedETeacher._assignedHubContact= {
                                _id: theUser._id,
                                name:theUser.name,
                                email: theUser.emailcanonical,
                              }
                              callback(null);
                          } else {
                              theInterestedETeacher._assignedHubContact= {
                                _id: null,
                                name:'',
                                email: theInterestedETeacher.assignedHubContact,
                              }
                              callback(null);
                          }
                      });
                  }


                  ],
                  function(err,results){
                      callback(null);
                  }
              );
          },
          function(err){
              return res.json(InterestedETeachers);
          });

      });

  });

  app.put('/dashboardapi/interestedteachers', utils.checkAuth, checkRoles("moocitoadmin"), function(req, res,next){
  log('put /dashboardapi/interestedteachers');
      var apiResult = {
        code:'200',
        message:'OK'
      };

      models.InterestedETeacher.findOne({_id:req.body.id}).exec(function(err,theInterestedETeacher){
         if(theInterestedETeacher){
            theInterestedETeacher.status = (req.body.status !== ''?req.body.status:theInterestedETeacher.status);
            theInterestedETeacher.assignedHub = req.body.hub;
            theInterestedETeacher.notes = req.body.notes;
            theInterestedETeacher.assignedHubContact = req.body.contact;

            theInterestedETeacher.save(function(err){
                if(!err){
                    return res.json(apiResult);
                } else {
                    apiResult.code= '500',
                    apiResult.message='User update failed'
                    res.status(apiResult.code).json(apiResult);
                }
            });
         } else {
            apiResult.code= '500',
            apiResult.message='User update failed'
            res.status(apiResult.code).json(apiResult);
         }
      });
  });


  app.get('/dashboardapi/moocspaces', utils.checkAuth, checkRoles("moocitoadmin"), function(req, res,next){
  log('get /dashboardapi/moocspaces');
      var apiResult = {
        code:'200',
        message:'OK'
      };
      models.MoocSpace.find({}).sort({nr:1}).lean().exec(function(err, MoocSpaces){
              return res.json(MoocSpaces);
      });
  });


  app.post('/dashboardapi/moocspaces', utils.checkAuth, checkRoles("moocitoadmin"), function(req, res,next){
      log('post /dashboardapi/moocspaces');
      var apiResult = {
        code:'200',
        message:'OK'
      };

      // quick hack: when req.body._id is there this is considered an update.
      // if not, its an insert.


      var message = '';

      // param validation....
      req.body.name = (req.body.name||'').trim();
      req.body.mainContact = req.body.mainContact ||'';
      req.body.category = (req.body.category || '').toUpperCase();
      req.body.start = req.body.start||'';
      req.body.end = req.body.end||'';
      //req.body.language = (req.body.language || '').toUpperCase();
      req.body.hub = (req.body.hub || '').toUpperCase();
      req.body.notes = req.body.notes || '';
      req.body.appformnr = req.body.appformnr || '';


      if(req.body.name === ''){
          message = 'Invalid course name';
      } else if(!validator.isEmail(req.body.mainContact)){
          message = req.body.mainContact + ' is not a valid email address';
      } else if(!(req.body.category=='ES'||req.body.category=='SS'||req.body.category=='HUM'||req.body.category=='NSM'||req.body.category=='BS'||req.body.category=='TS')){
          message = 'Invalid category';
      } else if(!validator.isDate(req.body.start)){
          message = req.body.start + ' is an invalid date';
      } else if(!validator.isDate(req.body.end)){
          message = req.body.end + ' is an invalid date';
      } else if(!(req.body.hub=='HUB1'||req.body.hub=='HUB2'||req.body.hub=='HUB3'||req.body.hub=='HUB4'||req.body.hub=='HUB5'||req.body.hub=='HUB6'||req.body.hub=='HUB7'||req.body.hub=='HUB8'||req.body.hub=='HUB9'||req.body.hub=='HUB10')){
          message = 'Invalid HUB';
      } else if(isNaN(parseInt(req.body.status))){
          req.body.status=25
      } else if(isNaN(parseInt(req.body.appformnr)) && (req.body.appformnr !=='') ){
          message = 'Invalid application form number';
      }


      if (message !== ''){
        apiResult = {
            code:'400',
            message:message
        }
        return res.status(apiResult.code).json(apiResult);
      }

      models.MoocSpace.findOne({_id:req.body._id}).exec(function(err,MoocSpace){
         if(!err){
            if(!MoocSpace){
                var MoocSpace =  new models.MoocSpace();
                log("inserting...")
            }
            MoocSpace.name = req.body.name;
            MoocSpace.status = req.body.status;
            MoocSpace.mainContact = req.body.mainContact;
            MoocSpace.category = req.body.category;
            MoocSpace.start = new Date(req.body.start);
            MoocSpace.end= new Date(req.body.end);
            MoocSpace.language= req.body.language;
            MoocSpace.hub= req.body.hub;
            //MoocSpace.readyInOpenMooc= req.body.readyInOpenMooc;
            //MoocSpace.published=req.body.published;
            MoocSpace.notes =  req.body.notes;
            MoocSpace.appformnr =  req.body.appformnr;

            MoocSpace.save(function(err){
                if(!err){
                    return res.json(apiResult);
                } else {
                    apiResult.code= '500',
                    apiResult.message='Update failed'
                    return res.status(apiResult.code).json(apiResult);
                }
            });
         } else {
             apiResult.code= '500',
             apiResult.message='Update failed'
             return res.status(apiResult.code).json(apiResult);
         }
      });
  });

  app.get('/dashboardapi/hubcontactpersons', utils.checkAuth, checkRoles("moocitoadmin"), function(req, res,next){
    log('get /dashboardapi/hubcontactpersons');
    var result = [];
    models.HubContactPerson.find().sort({hub:1}).lean().exec(function(err,persons){
        async.each(persons,
            function(person, callback){
                // Add only IDPUsers
                models.EcoUser.findOne({emailcanonical:person.email}).exec(function(err, theUser){
                    if(theUser){
                        result.push({
                            name: theUser.name,
                            _user: theUser._id,
                            hub:person.hub,
                            email:theUser.emailcanonical,
                        });
                    }
                    callback();
                });
            },
            function(err){
                return res.json(result);
            }
        );
    });
  });


  app.post('/dashboardapi/sendmail', utils.checkAuth, checkRoles("moocitoadmin"), function(req, res,next){
      log('post /dashboardapi/sendmail');
                                          7
      var apiResult = {
        code:'200',
        message:'OK'
      };

      var emailMessage = req.body.message||'';
      if (emailMessage.trim()===''){
          apiResult = {
            code:'500',
            message:'An empty message cannot be sent'
          };
          return res.status(apiResult.code).json(apiResult);
      }

      if(!Array.isArray(req.body.to)){
          req.body.to = [req.body.to];
      }

      // find emailadresses
      async.parallel([
          function(callback){
              models.EcoUser.findOne({_id: req.body.from}).exec(function(err,theUser){
                  if(theUser){
                      callback(null,theUser.emailcanonical);
                  } else {
                      callback({});
                  }
              });
          },
          function(callback){
              async.map(req.body.to,function(item, callback){
                  models.EcoUser.findOne({_id: item}).exec(function(err,theUser){
                      if(theUser){
                          callback(null,theUser.emailcanonical);
                      } else {
                          callback({});
                      }
                  });
                },
                function(err, toEmails){
                    if(!err){
                        callback(null, toEmails);
                    } else {
                        callback({});
                    }
                }
              );
          },
      ],
      function(err,results){
          if(!err && results[0] && results[1].length > 0){
              // get message template
              ejs.renderFile('views/mailmessage.ejs', {from: results[0], message:req.body.message||''},null, function(err, html){
                  if(!err){
                      log(html);
                      sendMail.sendSingleHtmlMail("noreply@ecolearning.eu", results[1], results[0],"ECO Backoffice: Message from "+results[0], html);
                      return res.status(apiResult.code).json(apiResult);
                  } else {
                      apiResult = {
                        code:'500',
                        message:'An error occurred while trying to send your message'
                      };
                      return res.status(apiResult.code).json(apiResult);
                  }
              });
          } else {
              apiResult = {
                code:'500',
                message:'An error occurred while trying to send your message'
              };
              return res.status(apiResult.code).json(apiResult);
          }
      });
  });

  app.get('/dashboardapi/moocs', utils.checkAuth, checkRoles("allmoocs"), function(req, res,next){
      log('get /dashboardapi/moocs');
      var apiResult = {
        code:'200',
        message:'OK'
      };
      models.EcoCourse.find({deleted:false}).sort({priority:-1}).select('title language spotlight priority').lean().exec(function(err, moocs){
              return res.json(moocs);
      });
  });

  app.post('/dashboardapi/moocs', utils.checkAuth, checkRoles("allmoocs"), function(req, res,next){
      log('post /dashboardapi/moocs');
      var apiResult = {
        code:'200',
        message:'OK'
      };

      var spotlight = req.body.spotlight+'';
      var priority = req.body.priority + '';
      var _id = req.body._id+'';

      if (((spotlight.trim()!=='true') && (spotlight.trim()!=='false')) || (!validator.isInt(priority, { min: 0, })) ){
          apiResult = {
            code:'500',
            message:'Invalid value'
          };
          return res.status(apiResult.code).json(apiResult);
      }

      models.EcoCourse.findOne({_id:_id}).exec(function(err, theCourse){
         if(theCourse){
             theCourse.spotlight = (spotlight==='true');
             theCourse.priority = priority;

             theCourse.save(function(err){
                    if(!err){
                        return res.json(apiResult);
                    } else {
                        apiResult.code= '500',
                        apiResult.message='Update failed'
                        return res.status(apiResult.code).json(apiResult);
                    }
             });
         } else {
            apiResult.code= '500',
            apiResult.message='Update failed'
            return res.status(apiResult.code).json(apiResult);
         }
      });
  });

}

// custom middleware
function checkRoles(role){
    return function(req,res,next){
      if(!req.accessToken || !req.accessToken._user ||! req.accessToken._user._id){
        var apiResult = {
          code:'500',
          message:'Internal server error'
        };
        return res.status(apiResult.code).json(apiResult);;
      }

      models.UserRoles.findOne({_user: req.accessToken._user._id}).lean().exec(function(err, theUserRoles){
          if (err || !theUserRoles || (theUserRoles.roles.indexOf(role)==-1) ){
              var apiResult = {
                      code:'401',
                      message:'Unauthorized'
              };
            return res.status(apiResult.code).json(apiResult);
          } else {
              return next()
          }
      });
    }
}


