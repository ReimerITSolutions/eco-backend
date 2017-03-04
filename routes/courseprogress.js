var async = require('async');
var moment = require('moment');
var cors = require('cors');


var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var utils = require('../utils.js');
var appSettings = require('../appSettings.js');


module.exports = function(app){
  app.get('/courseprogress/:sub', checkAuth, function(req, res,next){
      var apiResult = {
        code:'200',
        message:'OK'
      };

      /*
      // the supplied sub must equal to user._id
      if(req.params.sub !== req.accessToken._user._id.toHexString()){
            apiResult.code= '401',
            apiResult.message='Unauthorized'
            res.status(apiResult.code).json(apiResult);
            return;
      }
      */

      if(req.query && req.query.cached && req.query.cached==0){
        log('get /mycourses/:sub Live results',false);
         utils.updateUserAllCoursesProgress(req.params.sub)
         .done(function(){
            getCachedProgress(req.params.sub, req, res);
         })
      } else {
          log('get /mycourses/:sub Cached results',false);
          getCachedProgress(req.params.sub,req, res);
      }
  });


}


function checkAuth(req, res, next){
    log('Enter checkAuth middleware: headers:'+JSON.stringify(req.headers),false);

    var bearerToken = getHeadersBearerToken(req);
    // token opzoeken
    async.waterfall([
      function(callback) {
          models.AccessToken.findOne({token: bearerToken})
          .exec(function (err, accessToken)
              {
                  if (err || !accessToken ) {
                      callback({});
                  } else {
                      callback(null, accessToken.toObject({virtuals : true}))
                  }
              }
          );

          /* lets's replace this later by a IDP method in order to validate an AT
          .populate('_client _user')
          .exec(function (err, accessToken)
              {
                  if (err || !accessToken ||!accessToken._user || !accessToken._user._id || !accessToken._client || !accessToken._client._id) {
                      callback({});
                  } else {
                      callback(null, accessToken.toObject({virtuals : true}))
                  }
              }
          );
          */
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
                res.status(401).json(errorInfo);
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

function getCachedProgress(userId,req, res){
  models.UserCourseProgress.find({_user:userId},function(err,result){
      if(err || !result){
          res.status(500).json([]);
          return;
      }
      var myCourses = [];

      async.eachSeries(result,
        function(platformResult,callback){
            // add platform info
            debugger;
            models.moocPlatform.findOne({_id: platformResult._platform})
            .exec(function(err,thePlatform){
                var platformInfo=null;
                if(thePlatform){
                    platformInfo={
                      platformId:thePlatform._id,
                      platformName: thePlatform.name,
                      logoImageUrl: appSettings.imageLocationConsumer + '/' + thePlatform.logoName,
                      userCatchAllUrl: thePlatform.userCatchAllUrl,
                      userCatchAllTranslations: thePlatform.userCatchAllTranslations
                    };
                }
                // platformResult.coursesProgress contains the actuall progress of each taken course on this platform
                async.eachSeries(platformResult.coursesProgress,
                    function(course,callback){
                      var myCourse = {
                          _id: null,
                          title : null,
                          courseUrl: null,
                          courseImageUrl: null,
                          platformInfo:platformInfo,
                          progressPercentage: null,
                          firstViewDate : null,
                          lastViewDate : null,
                          completedDate: null,
                      }

                      if(course.hasOwnProperty("progressPercentage")){
                          myCourse.progressPercentage = course.progressPercentage;
                      } else {
                          myCourse.progressPercentage = null;
                      }

                      if(course.firstViewDate){
                        myCourse.firstViewDate =moment(course.firstViewDate).toDate();
                      }

                      if(course.lastViewDate){
                        myCourse.lastViewDate =moment(course.lastViewDate).toDate();
                      }

                      if(course.completedDate){
                        myCourse.completedDate =moment(course.completedDate).toDate();
                      }


                      // search course url, title and image
                      models.EcoCourse.findOne({'identifier.entry':course.id, _platform: thePlatform._id}).exec(function(err,theCourse){
                        if(!err && theCourse){
                            myCourse._id = theCourse._id;
                            myCourse.title = theCourse.title;
                            myCourse.courseUrl= theCourse.courseUrl;
                            myCourse.oaiPmhIdentifier = theCourse.oaiPmhIdentifier;
                            myCourse.deleted = theCourse.deleted;

                            if(theCourse.courseImageName && theCourse.courseImageName !=''){
                                myCourse.courseImageUrl = appSettings.imageLocationConsumer+'/courses/'+theCourse.courseImageName;
                            } else {
                                myCourse.courseImageUrl = appSettings.imageLocationConsumer+'/courses/default.png';
                            }

                        }

                        // only add course to the list if we were able to get details
                        if(myCourse.title){
                            myCourses.push(myCourse);
                        }
                        callback(null);
                      });
                    },
                    function(err){
                        callback(null);
                    }
                );
            });
        },
        function(err){
            // sort on course.firstViewDate . Most recent first.
            var s=myCourses.sort(function(a,b){
            var x,y;
                if(a.firstViewDate===null || a.firstViewDate ===""){
                    x=moment("2000-01-01");
                } else {
                    x=moment(a.firstViewDate);
                }

                if(b.firstViewDate ===null || b.firstViewDate ===""){
                    y=moment("2000-01-01");
                } else {
                    y=moment(b.firstViewDate);
                }

                return y.unix()-x.unix();
            });

            res.json(s);
            return;
        }
      );
      return;
  });
}


