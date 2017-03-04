var cors = require('cors');


var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var utils = require('../utils.js');
var appSettings = require('../appSettings.js');


module.exports = function(app){
  app.get('/coursesuggestions/:sub', function(req, res,next){
      var apiResult = {
        code:'200',
        message:'OK'
      };

      models.EcoUser.findOne({_id:req.params.sub},function(err,theUser){
          if(err || !theUser){
              log("/coursesuggestions/:sub user" + req.params.sub + " not found" ,true)
              res.status(200).json([]);
              return;
          } else {
            var userLanguage = theUser.language;
            var interests = (theUser.interests?theUser.interests:"");
            if (interests == ""){
                var a = [];
                // no interests? --> All
                a.push('ES');
                a.push('HUM');
                a.push('SS');
                a.push('NSM');
                a.push('BS');
                a.push('TS');
            } else {
                var a = (theUser.interests?theUser.interests:"").split(",");
            }
            // transform interest to the vuale as used in oai result
            var userInterests = a.map(function(c){
                return "ECO:" + c.toUpperCase();
            });
            log("/coursesuggestions/:sub :Looking for interesting courses based on: " + userLanguage +  "/" + JSON.stringify(userInterests) ,true)
            models.EcoCourse.find({
                  interestArea: {$in: userInterests},
                  language: userLanguage,
                  deleted: false,
                  courseGroup: 'EcoBase',
            }, function(err, courses){
                    if(err || !theUser){
                        res.status(200).json([]);
                        return;
                    } else {
                        result = [];
                        for(var i=0;i<courses.length;i++){
                            if(!courses[i].deleted){
                               var course =courses[i].toObject();
                               // delete unwanted properties
                               delete course._platform;
                               delete course.priority;
                               delete course.deleted;
                               delete course.__v;
                               delete course._id;
                                if(course.courseImageName && course.courseImageName !=''){
                                    course.courseImageUrl = appSettings.imageLocationConsumer+'/courses/'+course.courseImageName;
                                } else {
                                    course.courseImageUrl = appSettings.imageLocationConsumer+'/courses/default.png';
                                }
                                delete course.courseImageName;
                                result.push(course);
                            }
                        }
                        res.status(200).json(result);
                        return;
                    }
                });
          }
      });
  });
}


