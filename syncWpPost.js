var mongoose = require('mongoose');
var async = require('async');
var Q=require('q');

var appSettings = require('./appSettings.js');
var log = require('./log.js');

appSettings.mongoBackendConnection  = mongoose.createConnection('mongodb://'+ appSettings.mongoBackendDBUser + ":" + appSettings.mongoBackendDBPassword + '@' + appSettings.mongoHost + ':' + appSettings.mongoPort + '/' +appSettings.mongooseBackendDB);
appSettings.mongoIDPConnection = mongoose.createConnection('mongodb://'+ appSettings.mongoIDPDBUser + ":" + appSettings.mongoIDPDBPassword + '@' + appSettings.mongoHost + ':' + appSettings.mongoPort + '/' +appSettings.mongooseIDPDB);

appSettings.mongoBackendConnection.on('error', console.error.bind(console, 'connection error:'));
appSettings.mongoIDPConnection.once('open', function callback (){
    log('Backend MongoDB connected');
});

var models=require('./models.js');
var utils = require('./utils');
var wpposthandling=require('./wpposthandling.js');


    var WPPostsToTranslate=[
        { wpPostId:10527, // About ECO
          translationId: 290,
        },
        { wpPostId:11169, // E-Teacher FAQ
            translationId:291,
        },
        { wpPostId:10993, // E-Teacher Intro
            translationId:292,
        },
        /*
        { wpPostId:8497, // Office365 advert
            translationId: 271,
        },
        */
    ];

    async.mapSeries(WPPostsToTranslate,
      function(wpPost,callback){
          getWpPostTranslations(wpPost.wpPostId).then(function(translations){
              log("translations for wpPostId " + wpPost.wpPostId + ": " + JSON.stringify(translations),true);

              upsertMongoTranslation(wpPost.translationId, translations).then(function(){
                  callback(null);
              })
              .fail(function(){
                  callback(null);
              });
          })
          .fail(function(){
              callback(null);
          });
      },
      function(err, results){
          log('Finished!',true);
          mongoose.disconnect();
          process.exit(code=0);
      }
    );


function getWpPostTranslations(wpPostId){
    var deferred=Q.defer();
    var languages=['en','es','fr','it','de','pt'];

    async.mapSeries(languages,
        function(lang,callback){
            // get the content from wordpress
            wpposthandling.getWpPost(wpPostId, lang)
            .then(function(post){
                    callback(null,{
                        language: lang,
                        text: post.html,
                    });
            })
            .fail(function(){
                    callback({});
            })
        },
        function(err, results){
            if(err){
                deferred.reject();
            } else {
                deferred.resolve(results);
            }
        }
    );
    return deferred.promise;
}

function upsertMongoTranslation(translationId, translations){
    var deferred=Q.defer();

    models.Translation.findOne({id:translationId}, function(err, theTranslation){
        if(err){
            deferred.reject();
            return;
        }
        if(!theTranslation){
            log('INSERT',true);
            theTranslation = new models.Translation();
            theTranslation.id = translationId;
        } else {
            log('UPDATE',true);
        }

        theTranslation.translations=translations;
        theTranslation.save(function(err, trans){
            deferred.resolve();
        });

    });


    return deferred.promise;
}


