var moment=require("moment");
var fs=require("fs");
var mongoose = require('mongoose');
var fs = require('fs');
var async = require('async');
var Q=require('q');

var appSettings = require('./appSettings.js');
var log = require('./log.js');

var theUserEmail = 'k.loozen@reimeritsolutions.nl';

function report(){
    var result={};
    models.EcoUser.findOne({
      emailcanonical: theUserEmail
    }).exec(function(err,theUser){
        if(theUser){
            result.email = theUser.emailcanonical;
            result.ecoUserId = theUser._id;
            result.nickname = theUser.nickname;
            result.uniqueUserName = theUser.uniqueUserName;

            getCachedProgress(theUser._id).then(function(progress){
                result.coursesPerPlatform = progress;
                //log(JSON.stringify(result),true);

                console.log('User email: ' + theUser.emailcanonical);
                console.log('ecoUserId: ' + theUser._id);
                console.log('nickname: ' + theUser.nickname);
                console.log('uniqueUserName: ' + theUser.uniqueUserName);
                console.log('courses:');

                // sort by platform
                progress.sort(function(a,b){
                    if ( a.platformInfo.platformName < b.platformInfo.platformName )
                        return -1;
                    if ( a.platformInfo.platformName > b.platformInfo.platformName )
                        return 1;
                    return 0;
                });

                var platform=""
                for(var n=0;n<progress.length;n++){
                    if(platform !== progress[n].platformInfo.platformName){
                        console.log(progress[n].platformInfo.platformName + ": ");
                        platform = progress[n].platformInfo.platformName;
                    }
                    console.log("  " + progress[n].title[0].string);
                }
                exit();
            });
        } else {
          log(JSON.stringify(result),true);
          exit();
        }


    });
}

function exit(){
  mongoose.disconnect();
  process.exit(code=0);
}

function getCachedProgress(userId){

  var deferred = Q.defer();
  models.UserCourseProgress.find({_user:userId},function(err,result){
      if(err || !result){
          deferred.resolve({});
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

                        } else {
                            myCourse.title = 'UNKNOWN';
                        }

                        myCourses.push(myCourse);
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

            deferred.resolve(s);
            return;
        }
      );
      return;
  });

  return deferred.promise;
}


function getEnrolledCourses(courseProgress){
    var deferred = Q.defer();

    models.moocPlatform.findOne({_id: courseProgress._platform}).lean().exec(function(err, thePlatform){
        log(thePlatform.oaiPmhUrl,true);

        async.map(courseProgress.coursesProgress,
            function(courseProgress, callback){
                // find course
                log(thePlatform._id + ' ' + courseProgress.id,true);
                models.EcoCourse.findOne({$and: [{'identifier.entry': courseProgress.id}]}).exec(function(err, theCourse){
                    if (theCourse){
                        log(theCourse.title[0].string,true);
                    }
                    callback(null);
                });
            },
            function(){
                deferred.resolve();
            }
        );


    });


    return deferred.promise;
}




appSettings.mongoBackendConnection  = mongoose.createConnection('mongodb://'+ appSettings.mongoBackendDBUser + ":" + appSettings.mongoBackendDBPassword + '@' + appSettings.mongoHost + ':' + appSettings.mongoPort + '/' +appSettings.mongooseBackendDB);
appSettings.mongoIDPConnection = mongoose.createConnection('mongodb://'+ appSettings.mongoIDPDBUser + ":" + appSettings.mongoIDPDBPassword + '@' + appSettings.mongoHost + ':' + appSettings.mongoPort + '/' +appSettings.mongooseIDPDB);

appSettings.mongoBackendConnection.on('error', console.error.bind(console, 'connection error:'));
appSettings.mongoIDPConnection.once('open', function callback (){
    log('MongoDB connected',true);
    models=require("./models.js");
    utils=require('./utils.js');

    report();

});









