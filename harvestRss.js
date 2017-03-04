var DOMParser = require('xmldom').DOMParser;
var request = require('request');
var httpsync = require('httpsync');
var fs = require('fs');
var mongoose = require('mongoose');
var async = require('async');

var appSettings = require('./appSettings.js');
var log = require('./log.js');
var util = require('util');

var util = require('util');
var EventEmitter = require('events').EventEmitter;



var appSettings = require('./appSettings.js');

appSettings.mongoBackendConnection  = mongoose.createConnection('mongodb://localhost' + ':' + appSettings.mongoPort + '/' +appSettings.mongooseBackendDB );
appSettings.mongoIDPConnection     = mongoose.createConnection('mongodb://localhost' + ':' + appSettings.mongoPort + '/' +appSettings.mongooseIDPDB);
//appSettings.mongoBackendConnection  = mongoose.createConnection('mongodb://localhost/' + appSettings.mongooseBackendDB );
//appSettings.mongoIDPConnection     = mongoose.createConnection('mongodb://localhost/' + appSettings.mongooseIDPDB);

appSettings.mongoBackendConnection.on('error', console.error.bind(console, 'connection error:'));
appSettings.mongoIDPConnection.once('open', function callback (){
    log('Backend MongoDB connected');
});

var models=require('./models.js');




        var req = httpsync.get({ url : 'http://ecolearning.eu/feed/'});
        var res = req.end();
        var xml = res.data.toString("utf-8");
        var rssXmlDoc = new DOMParser().parseFromString(xml,'text/xml');
        var items = rssXmlDoc.getElementsByTagName("item");


var rssReader = new EventEmitter();
var itemIndex = -1;

rssReader.on('nextArticle',function(){
            itemIndex++;
            if(itemIndex >=items.length){
                log('Done!');
                process.exit(code=0);
            }

            var titleElements = items[itemIndex].getElementsByTagName("title");
            var title=null;
            if(titleElements.length == 1 && titleElements[0].childNodes[0].nodeType==3){
                title=titleElements[0].childNodes[0].nodeValue;
            }


            var linkElements = items[itemIndex].getElementsByTagName("link");
            var link=null
            if(linkElements.length == 1 && linkElements[0].childNodes[0].nodeType==3){
                link=linkElements[0].childNodes[0].nodeValue;
            }

            var pubDateElements = items[itemIndex].getElementsByTagName("pubDate");
            var pubDate =null;
            if(pubDateElements.length == 1 && pubDateElements[0].childNodes[0].nodeType==3){
                try {
                    pubDate = new Date(pubDateElements[0].childNodes[0].nodeValue);
                } catch(e){
                    pubDate = new Date();
                }
            }

            var creatorElements = items[itemIndex].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/","creator");
            var creator='';
            if(creatorElements.length == 1 && creatorElements[0].childNodes[0].nodeType==4){
                creator=creatorElements[0].childNodes[0].nodeValue;
            }

            var categoryElements = items[itemIndex].getElementsByTagName("category");
            var category='';
            if(categoryElements.length == 1 && categoryElements[0].childNodes[0].nodeType==4){
                category=categoryElements[0].childNodes[0].nodeValue;
            }

            var descriptionElements = items[itemIndex].getElementsByTagName("description");
            var description=null;
            if(descriptionElements.length == 1 && descriptionElements[0].childNodes[0].nodeType==4){
                description=descriptionElements[0].childNodes[0].nodeValue;
            }



            var guid=null;
            var guidElements = items[itemIndex].getElementsByTagName("guid");
            if(guidElements.length == 1 && guidElements[0].childNodes[0].nodeType==3){
                guid=guidElements[0].childNodes[0].nodeValue;
            }

            if(title &&description&&guid){
                models.rssArticle.findOne({guid: guid}).exec(function (err, theArticle){
                      if(!theArticle){
                        article = new models.rssArticle({
                          guid: guid,
                          title: title,
                          link: link,
                          pubDate: pubDate,
                          creator: creator,
                          category: category,
                          description: description,
                        });

                        article.save();
                        rssReader.emit('nextArticle');

                      } else {
                          rssReader.emit('nextArticle');
                      }
                });
            }
});


rssReader.emit('nextArticle');







