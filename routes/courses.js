var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var cors = require('cors');
var moment=require('moment');

var appSettings = require('../appSettings.js');

module.exports = function(app){
  app.get('/courses', function(req, res,next){
    var apiResult = {
      code:'200',
      message:'OK'
    };

    log('/get courses');
    log(JSON.stringify(req.query));
    if(!req.query ){
        res.json(apiResult);
        return;
    }
    //debugger;
    var courseGroup='ALL';
    try {
        courseGroup=req.query.coursegroup.toUpperCase();
    } catch (e) {}
    if (courseGroup !=='ECOBASE'){
        courseGroup ='ALL';
    }

    var language='ALL';
    try {
        language=req.query.lang.toLowerCase();
    } catch (e) {}
    if (language!=='en' && language!=='de' && language!=='pt' && language!=='es' && language!=='fr' && language!=='it'){
        language='ALL';
    }

    var interestArea='ALL';
    try {
        interestArea=req.query.ia.toUpperCase();
    } catch (e) {}
    if (interestArea!=='ECO:ES' && interestArea!=='ECO:SS' && interestArea!=='ECO:HUM' && interestArea!=='ECO:NSM' && interestArea!=='ECO:BS' && interestArea!=='ECO:TS'){
        interestArea='ALL'
    }

    var top=false;
    try {
        top= (req.query.top.toUpperCase()==='TOP');
    } catch (e) {}

    var current=false;
    try {
        current= (req.query.current.toUpperCase()==='CURRENT');
    } catch (e) {}


    var textSearch='';
    try {
        textSearch=req.query.search.toLowerCase();
        textSearch=textSearch.replace(/[\$!@#%^&_\-+=~`'":;\[\]\/\\\<\>\(\)*\{\},.?]/g, " ");
        textSearch=textSearch.trim();
    } catch (e) {}


    // standard filters: Only non-deleted courses, with setSpec 'EcoBase'
    var findObject = {
        deleted:false,
    }

    if(courseGroup ==='ECOBASE'){
        findObject.courseGroup = 'EcoBase';
    }

    if(textSearch !== '' ){
        // text search => no other filters
        findObject['$text'] = { "$search" : textSearch} ;
    } else {
      if (language!=='ALL'){
        findObject.language=language;
      }
      if (interestArea!=='ALL'){
        findObject.interestArea=interestArea;
      }
    }


    if(top){
        findObject.spotlight=1;
    }

    if(current){
        var today= moment.utc();
        findObject.startDate = {$lte: today.toDate()};
        findObject.endDate = {$gte: today.toDate()};
    }



    log('/get courses findObject:' + JSON.stringify(findObject),true);
    models.EcoCourse.find(findObject).sort({priority:-1,startDate:-1}).populate('_platform').exec(function(err, courses){
      if(courses){
          var result = new Array();
          for(var i=0;i<courses.length;i++){
            var course={};
            course.oaiPmhIdentifier=courses[i].oaiPmhIdentifier;
            course.title=courses[i].title;
            course.interestArea=courses[i].interestArea;
            course.startDate=courses[i].startDate;
            course.endDate=courses[i].endDate;
            course.nrOfUnits=courses[i].nrOfUnits;

            if(courses[i].courseUrl){
                course.courseUrl=courses[i].courseUrl;
                if(course.courseUrl.indexOf('http')<0){
                    course.courseUrl = 'http://' + course.courseUrl;
                }
            }
            course.language=courses[i].language;
            course.description=courses[i].description;
            // add universities
            course.organizers = courses[i].organizers;
            course.studyLoad  = courses[i].studyLoad;
            course.courseGroup  = courses[i].courseGroup;

            // add platform info
            course.platformInfo = {};
            if(courses[i]._platform){ // if platform is deleted for whatever reason, this should not crash the routine...
              course.platformInfo.platformName = courses[i]._platform.name;
              course.platformInfo.logoImageUrl =  appSettings.imageLocationConsumer + '/' + courses[i]._platform.logoName;
            }

            // add teacher info
            course.teachers = new Array();
            for(var j=0;j<courses[i].teachers.length;j++){
                course.teachers.push({
                  name:courses[i].teachers[j].name || '',
                });
            }

            course.duration=translateDuration(courses[i].typicalLearningTime);
            if(courses[i].courseImageName && courses[i].courseImageName !=''){
                course.courseImageUrl = appSettings.imageLocationConsumer+'/courses/'+courses[i].courseImageName;
            } else {
                course.courseImageUrl = appSettings.imageLocationConsumer+'/courses/default.png';
            }
            result.push(course);
          }
          res.json(result);
          log('/get courses: ' + result.length + ' sent');
      } else {
          res.json(apiResult);
      }
    });



  });
}





function translateDuration(duration){
  // Check for P[yY][mM][dD][T[hH][mM]] format
  var result= {
          years:null,
          months:null,
          days:null,
          hours:null,
          minutes:null,
  }

  try {
    var patt = new RegExp(/P((\d)*Y)?((\d)*M)?((\d)*D)?(T((\d)*H)?((\d)*M)?)?/i);

    if(patt.test(duration)){
      var years=null;
      var months=null;
      var days=null;
      var minutes=null;
      var hours=null;

      if(duration){
        var T=duration.indexOf('T');
        if(T>=0){  // time part
            var time=duration.substring(T+1);
            var H=time.indexOf('H');
            if(H>=0){
                hours=time.substring(0,H);
                time=time.substring(H+1);
            }
            var M=time.indexOf('M');
            if(M>=0){
                minutes=time.substring(0,M);
            }
            duration=duration.substring(0,T);
        }

        duration=duration.substring(1);  // P eraf
        var Y=duration.indexOf('Y');
        if(Y>=0){
            years=duration.substring(0,Y);
            duration=duration.substring(Y+1);
        }
        var M=duration.indexOf('M');
        if(M>=0){
            months=duration.substring(0,M);
            duration=duration.substring(M+1);
        }
        var D=duration.indexOf('D');
        if(D>=0){
            days=duration.substring(0,D);
        }

      }

      result= {
          years:(!years||years==""?null:years),
          months:(!months||months==""?null:months),
          days:(!days||days==""?null:days),
          hours:(!hours||hours==""?null:hours),
          minutes:(!minutes||minutes==""?null:minutes),
      }

    }
  } catch(e) {
  }

  return result
}

