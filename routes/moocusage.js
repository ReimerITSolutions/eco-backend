var async = require('async');
var moment = require('moment');
var sanitizeHtml = require('sanitize-html');
var cors = require('cors');


var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');

module.exports = function(app){
  app.get('/moocusage', function(req, res,next){

    models.courseStatistics.find({}).populate('_course').exec(function(err, stats){
      result = [];

      if(stats){
          var result = new Array();
          for(var i=0;i<stats.length;i++){
            var courseStat={};
            courseStat.oaiPmhIdentifier = stats[i]._course.oaiPmhIdentifier;
            courseStat.courseTitle = cleanUp(getLanguageString((stats[i]._course?stats[i]._course.title:[]),'en').string) || 'Unknown course';
            courseStat.languages = (stats[i]._course?stats[i]._course.language.join(","):"");
            courseStat.countUsersEn = stats[i].countUsersEn;
            courseStat.countUsersEs = stats[i].countUsersEs;
            courseStat.countUsersFr = stats[i].countUsersFr;
            courseStat.countUsersIt = stats[i].countUsersIt;
            courseStat.countUsersPt = stats[i].countUsersPt;
            courseStat.countUsersDe = stats[i].countUsersDe;
            courseStat.totalUsers = stats[i].totalUsers;

            result.push(courseStat);
          }
          // sort results on courseTitle
          result.sort(function(a,b){
            if(a.courseTitle.toUpperCase() < b.courseTitle.toUpperCase()){
                return -1;
            }
            if(a.courseTitle.toUpperCase() > b.courseTitle.toUpperCase()){
                return 1;
            }
            return 0;
          });
      }

      res.json(result);
      log('/get moocusage:' + result.length + ' send');
    });
  });
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
