var url = require('url');
var DOMParser = require('xmldom').DOMParser;
var request = require('request');
var fs = require('fs');
var mongoose = require('mongoose');
var async = require('async');
var sanitizeHtml = require('sanitize-html');
var https = require('https');
var http = require('http');
var Q=require('q');
var imageType = require('image-type');
var EventEmitter = require('events').EventEmitter;
var gm = require('gm');
var util = require('util');
var hash = require('object-hash');

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

var PageProcessor = function(){
    var self=this;
    this.OAITargets = new Array();
    this.OAITargetIndex = -1;
    this.CurrentTargetRecordCounter=0;
    this.currentXmlDoc = null;
    this.currentXmlRecords = null,
    this.currentXmlRecordPointer = null,
    this.resumptionToken = null;

    this.harvest=function(){
      models.moocPlatform.find().exec(function (err, thePlatforms){
          // define targetlist
          if(thePlatforms){
            for(var i=0;i<thePlatforms.length;i++){
                if(thePlatforms[i].oaiPmhUrl && thePlatforms[i].doHarvest && thePlatforms[i].oaiPmhUrl !== ''){
                    self.OAITargets.push(thePlatforms[i]);
                }
            }
            // start looping each oai target sequentially
            self.OAITargetIndex = -1;
            self.emit('harvestNextTarget');
          }
      });
    }

    this.on('harvestNextTarget', function(){
        self.OAITargetIndex++;

        if(self.OAITargets[self.OAITargetIndex]){
          log('Start harvesting target ' + self.OAITargets[self.OAITargetIndex].name,true);
          self.CurrentTargetRecordCounter=0;
          var commands='verb=ListRecords&metadataPrefix=oai_lom';
          var url = self.OAITargets[self.OAITargetIndex].oaiPmhUrl;
          self.processOAITargetPage(url, commands);
        } else {
            exit('Finished!');
        }
    });

    this.processOAITargetPage=function(theUrl, commands){
      utils.urlGETRequest(theUrl + '?' + commands, appSettings.httpRequestTimeout)
      .then(function(data){
          if(data !=''){
            self.emit('pageReceived',data);
          } else {
              log('ERROR: No data received on ' + theUrl + '?' + commands,true);
              self.emit('harvestNextTarget');
          }
      })
      .fail(function(err){
          log('ERROR: Url Request Fault:' + err +  JSON.stringify(err),true);
          self.emit('harvestNextTarget');
      })
    }

    this.on('pageReceived',function(data){
        try {
          var xmlDoc = new DOMParser().parseFromString(data,"application/xml");
          removeWhitespace(xmlDoc);    // delete empty textnodes
          self.resumptionToken = (xmlDoc.getElementsByTagName("resumptionToken")[0]?xmlDoc.getElementsByTagName("resumptionToken")[0].childNodes[0].nodeValue:null);
          self.currentXmlRecords = xmlDoc.getElementsByTagNameNS("http://www.openarchives.org/OAI/2.0/","record");
          self.currentXmlRecordPointer = -1,
          // start looping the records
          self.emit('processNextRecord');
        }  catch(e){
            log('ERROR: catch error:' + e, true);
            self.emit('harvestNextTarget');
        }
    });

    this.on('getNextPage', function(listener){
      if(self.resumptionToken){
         var commands="verb=ListRecords&metadataPrefix=oai_lom&resumptionToken="+self.resumptionToken;
         var url = self.OAITargets[self.OAITargetIndex].oaiPmhUrl;
         self.processOAITargetPage(url, commands);
      } else{
        self.emit('harvestNextTarget');
      }
    });


    this.on('processNextRecord',function(){
    debugger;
        self.currentXmlRecordPointer++;
        if(self.currentXmlRecordPointer == self.currentXmlRecords.length){
            self.emit('getNextPage');
        } else {
            var record= self.currentXmlRecords[self.currentXmlRecordPointer];
            parseRecord(record);
        }
    });


    this.on('parseResultReady',function(dbRecord){
        debugger;
        if (dbRecord && dbRecord.dbAction == null){
                self.emit('processNextRecord');
        }
        if (dbRecord && dbRecord.dbAction === 'delete'){
          async.waterfall([
            function(callback){
                models.EcoCourse.findOne({oaiPmhIdentifier: dbRecord.oaiPmhIdentifier}).exec(function (err, theCourse){
                  if(theCourse){
                    log('marking course as deleted: ' + dbRecord.oaiPmhIdentifier,true);
                    theCourse.deleted = true;
                    theCourse.save(function(err, theCourse){
                        if(err){
                            callback(err);
                        } else {
                            callback(null,theCourse);
                        }
                    })
                  } else {
                    // course not found, so nothing to do
                      callback("EcoCourse not found",null);
                  }
                });
            },
            function(theCourse, callback){  // update oaiMetadata records if neccesary
                updateOaiMetaData(theCourse)
                .done(function(){
                    callback(null);
                });
            }
            ],function(err){
                if(err){
                  log('ERROR:'+err, true);
                }
                self.emit('processNextRecord');
            }
          );
        }

        if (dbRecord && dbRecord.dbAction === 'update'){
          // upsert the course into the database
          // if required fields are not present then NO upsert!
          if(dbRecord.lomTitles && (dbRecord.lomTitles.length>0) && dbRecord.lomDescriptions && (dbRecord.lomDescriptions.length >0) && dbRecord.lomLanguage && (dbRecord.lomLanguage.length >0) && dbRecord.lomLocation && dbRecord.organizers && (dbRecord.organizers.length >0) && dbRecord.interestArea){
            async.waterfall([
              function(callback){
                  models.EcoCourse.findOne({oaiPmhIdentifier: dbRecord.oaiPmhIdentifier}).exec(function (err, theCourse){
                    if(theCourse){
                        log('updating course ' + dbRecord.oaiPmhIdentifier,true);
                        // when deleted flag is removed for some reason, make course visible again
                        theCourse.deleted = false;
                        updateCourseFields(theCourse,dbRecord);
                        callback(null,theCourse);
                    } else {
                        log('inserting course ' + dbRecord.oaiPmhIdentifier,true)
                        var theCourse= new models.EcoCourse({
                            _platform:self.OAITargets[self.OAITargetIndex]._id,
                            oaiPmhIdentifier: dbRecord.oaiPmhIdentifier,
                            deleted: false,
                            submissionTimstamp: new Date()
                        });
                        updateCourseFields(theCourse,dbRecord);
                        callback(null,theCourse);
                    }
                  });
              },
              function(theCourse, callback){
                  theCourse.save(function(err, theCourse){
                      if(err){
                          callback(err);
                      } else {
                          callback(null,theCourse);
                      }
                  })
              },
              function(theCourse, callback){
                  // save the image and update the course with the imagename
                  if(dbRecord.imageBuffer){
                    var imageName=theCourse._id+'.'+imageType(dbRecord.imageBuffer).ext;
                    gm(dbRecord.imageBuffer,imageName)
                    .resize(300)  // default size for display in portal
                    .write(appSettings.imageLocation+'/courses/'+imageName, function (err) {
                        if(err){
                            callback(err);
                        } else {
                            // create image that is suitable for social sharing
                            gm(dbRecord.imageBuffer,imageName)
                            .resize(400)
                            .write(appSettings.imageLocation+'/courses/FB/'+imageName, function (err) {
                                theCourse.courseImageName=imageName;
                                theCourse.save(function(err, theCourse){
                                    if(err){
                                        callback(err);
                                    } else {
                                        callback(null,theCourse);
                                    }
                                });
                            });
                        }
                    });
                  } else {
                      callback(null,theCourse);  
                  }
              },
              function(theCourse,callback){  // update oaiMetadata records if neccesary
                  updateOaiMetaData(theCourse)
                  .done(function(){
                      callback(null);
                  })
              }

            ],function (err){
                  if(err){
                    log('ERROR:'+err,true);
                  }
                  self.emit('processNextRecord');
            });
          } else {
              log('NOT upserting course because  missing required field(s)',true);
              self.emit('processNextRecord');
          }
        }
    });


  // parses a specific record and emits an event when done.
  function parseRecord(record){
      debugger;
      try {
        var dbRecord=null;
        headerElement = record.getElementsByTagNameNS("http://www.openarchives.org/OAI/2.0/","header")[0];

        if(!headerElement){
            log('ERROR: No header element',true);
            self.emit('parseResultReady',dbRecord);
            return;
        }

        var oaiPmhIdentifier=null;
        identifierElement = headerElement.getElementsByTagNameNS("http://www.openarchives.org/OAI/2.0/","identifier")[0];
        if(!identifierElement){
            log('ERROR: No identifier element',true);
            self.emit('parseResultReady',dbRecord);
            return;
        } else {
            oaiPmhIdentifier = identifierElement.childNodes[0].nodeValue;
            log('oaiPmhIdentifier: ' + oaiPmhIdentifier,true);

        }

        var oaiPmhSetSpec=null;
        setSpecElement = headerElement.getElementsByTagNameNS("http://www.openarchives.org/OAI/2.0/","setSpec")[0];
        if(setSpecElement){
            oaiPmhSetSpec = setSpecElement.childNodes[0].nodeValue;
            log("setSpec: " + oaiPmhSetSpec,true);
        }


        var dbRecord={
          dbAction: null,
          oaiPmhIdentifier:oaiPmhIdentifier,
          courseGroup: oaiPmhSetSpec,
        };

        status=headerElement.getAttributeNode("status");
        if(status && status.nodeValue === 'deleted'){
            dbRecord.dbAction = 'delete';
            self.emit('parseResultReady',dbRecord);
            return;
        }


        metadata=record.getElementsByTagNameNS("http://www.openarchives.org/OAI/2.0/","metadata")[0];
        if (!metadata){
            log('ERROR: No metadata element',true);
            self.emit('parseResultReady',dbRecord);
            return;
        }

        // metadata found!
        //console.log(metadata.toString());
        dbRecord.dbAction = 'update';

        var identifierElement = metadata.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","identifier")[0];

        if(identifierElement){
          for(var i=0;i<identifierElement.childNodes.length;i++){
              if(identifierElement.childNodes[i].nodeType==1 && identifierElement.childNodes[i].localName == 'catalog'){
                  var catalog = identifierElement.childNodes[i].childNodes[0].nodeValue;
              }
              if(identifierElement.childNodes[i].nodeType==1 && identifierElement.childNodes[i].localName == 'entry'){
                  var entry = identifierElement.childNodes[i].childNodes[0].nodeValue;
              }
          }

          dbRecord.lomIdentifier={
              "catalog" : catalog,
              "entry" : entry
          };
        }
        console.log("identifier: " + JSON.stringify(dbRecord.lomIdentifier));

        dbRecord.lomTitles=[];
        titleElement = metadata.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","title")[0];
        if(titleElement){
          for(var i=0;i<titleElement.childNodes.length;i++){
              if(titleElement.childNodes[i].nodeType==1 && titleElement.childNodes[i].localName == 'string'){
                  if(titleElement.childNodes[i].childNodes[0]){
                    var str = cleanUp(titleElement.childNodes[i].childNodes[0].nodeValue);
                    var language=titleElement.childNodes[i].attributes[0].nodeValue;
                    language=((language!=="null" && language!=="") ?language:null);
                    // no bullshit please!
                    if(language){
                      dbRecord.lomTitles.push({
                        "language" : ((language!=="null" && language!=="") ?language:null),
                        "string" : str
                      });
                    }
                  }


              }
          }
        }
        log("title: " +JSON.stringify(dbRecord.lomTitles),true);

        dbRecord.lomDescriptions = [];
        descriptionElement = metadata.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","description")[0];
        if(descriptionElement){
          //console.log(descriptionElement.toString());

          for(i=0;i<descriptionElement.childNodes.length;i++){
              if(descriptionElement.childNodes[i].nodeType==1 && descriptionElement.childNodes[i].localName == 'string'){
                  if(descriptionElement.childNodes[i].childNodes[0]){
                    var str = cleanUp(descriptionElement.childNodes[i].childNodes[0].nodeValue);
                    var language=descriptionElement.childNodes[i].attributes[0].nodeValue;
                    language=((language!=="null" && language!=="") ?language:null);
                    // no bullshit please!
                    if(language){
                      dbRecord.lomDescriptions.push({
                        "language" : ((language!=="null" && language!=="") ?language:null),
                        "string" : str
                      });
                    }
                  }

              }
          }
        }
        log("description: " +JSON.stringify(dbRecord.lomDescriptions));

        dbRecord.lomLanguage = [];
        languageElements = metadata.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","language");
        if(languageElements){
          //console.log(descriptionElement.toString());

          for(i=0;i<languageElements.length;i++){
              if (languageElements[i].childNodes[0] && languageElements[i].childNodes[0].nodeType==3){
                  var lang=languageElements[i].childNodes[0].nodeValue;
                  // no bullshit please!
                  if(lang!=="null" && lang!==""){
                      dbRecord.lomLanguage.push(lang);
                  }
              }
          }
        }
        log("language: " +JSON.stringify(dbRecord.lomLanguage));


        dbRecord.lomLocation = null;
        locationElement = metadata.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","location")[0];
        location = null;
        if(locationElement){
          if (locationElement.childNodes[0] && locationElement.childNodes[0].nodeType==3){
              var loc=locationElement.childNodes[0].nodeValue;
              if(loc!=="null" && loc!==""){
                  dbRecord.lomLocation=loc;
              }
          }
        }
        log("location: " +JSON.stringify(dbRecord.lomLocation));



        dbRecord.lomTypicalLearningTime=null;
        educationalElement= metadata.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","educational")[0];
        if(educationalElement){
          durationElement = educationalElement.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","duration")[0];
          if(durationElement){
            if (durationElement.childNodes[0] && durationElement.childNodes[0].nodeType==3){
                var dur=durationElement.childNodes[0].nodeValue;
                if(dur!=="null" && dur !==""){
                    dbRecord.lomTypicalLearningTime=dur;
                }
            }

            if (durationElement.childNodes[0] && durationElement.childNodes[0].nodeType==3){
                var dur=durationElement.childNodes[0].nodeValue;
                if(dur!=="null" && dur !==""){
                    dbRecord.lomTypicalLearningTime=dur;
                }
            }
          }
        }
        log("TypicalLearningTime: " +JSON.stringify(dbRecord.lomTypicalLearningTime));


        dbRecord.nrOfUnits=null;
        nrUnitsElement= metadata.getElementsByTagNameNS("http://www.ecolearning.eu/xsd/LOM","nrOfUnits")[0];
        if(nrUnitsElement){
            if (nrUnitsElement.childNodes[0] && nrUnitsElement.childNodes[0].nodeType==3){
                var nr=nrUnitsElement.childNodes[0].nodeValue;
                if(nr!=="null" && nr!==""){
                    dbRecord.nrOfUnits=nr;
                }
            }
        }
        log("nrOfUnits: " +JSON.stringify(dbRecord.nrOfUnits));

        dbRecord.startDate=null;
        startDateElement= metadata.getElementsByTagNameNS("http://www.ecolearning.eu/xsd/LOM","startDate")[0];
        if(startDateElement){
            if (startDateElement.childNodes[0] && startDateElement.childNodes[0].nodeType==3){
                var start=startDateElement.childNodes[0].nodeValue;
                if(nr!=="null" && nr!==""){
                    dbRecord.startDate=start;
                }
            }
        }
        log("startDate: " +JSON.stringify(dbRecord.startDate));

        dbRecord.endDate=null;
        endDateElement= metadata.getElementsByTagNameNS("http://www.ecolearning.eu/xsd/LOM","endDate")[0];
        if(endDateElement){
            if (endDateElement.childNodes[0] && endDateElement.childNodes[0].nodeType==3){
                var end=endDateElement.childNodes[0].nodeValue;
                if(end!=="null" && end!==""){
                    dbRecord.endDate=end;
                }
            }
        }
        log("endDate: " +JSON.stringify(dbRecord.endDate));



        dbRecord.studyLoad=null;
        studyLoadElement= metadata.getElementsByTagNameNS("http://www.ecolearning.eu/xsd/LOM","studyLoad")[0];
        if(studyLoadElement){
            if (studyLoadElement.childNodes[0] && studyLoadElement.childNodes[0].nodeType==3){
                var nr=studyLoadElement.childNodes[0].nodeValue;
                if(nr >>> 0 === parseFloat(nr)){  // fancy positive integer check
                    dbRecord.studyLoad=nr;
                }
            }
        }
        log("studyLoad: " +JSON.stringify(dbRecord.studyLoad));


        dbRecord.teachers = [];
        lifeCycleElement= metadata.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","lifeCycle")[0];
        if(lifeCycleElement){
          // find all contributors with role 'author'
          contributorsElements = lifeCycleElement.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","contribute");
          if(contributorsElements){
              for(i=0;i<contributorsElements.length;i++){
                  // just add authors
                  role=contributorsElements[i].getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","role")[0];
                  if(role){
                    var value=null;
                    try {
                      value= role.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","value")[0].childNodes[0].nodeValue;
                    } catch(e) {}
                    var vcard=null;

                    if(value === 'author'){
                      try {
                          vcard=contributorsElements[i].getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","entity")[0].childNodes[0].nodeValue;
                      } catch(e){}

                      if(vcard){
                        var teacher = {
                            id:'',
                            name:''
                        };
                        var lines =vcard.split("\r\n");
                        for(j=0;j<lines.length;j++){
                            if(lines[j].indexOf('UID:urn:uuid:')==0){
                                teacher.id=lines[j].substr(13);
                                //log(lines[j].substr(13));
                            }
                            if(lines[j].indexOf('FN:')==0){
                                teacher.name=lines[j].substr(3);
                                //log(lines[j].substr(3));
                            }
                        }

                        if(teacher.name !== ''){
                            dbRecord.teachers.push(teacher);
                        }
                        // try to add this teacher in the teacher collection, or update
                        /*
                        if(teacher.id !== ''){
                          models.EcoTeacher.findOne({
                              clientId: self.OAITargets[self.OAITargetIndex]._id,
                              localId: teacher.id
                          }).exec(function(err,theTeacher){
                              if(!theTeacher){
                                  var theTeacher=new models.EcoTeacher({
                                    platformId: self.OAITargets[self.OAITargetIndex]._id,
                                    localId: teacher.id,
                                    name: teacher.name,
                                    imageName: null,
                                    description:null,
                                  });
                                  theTeacher.save();
                              } else if(theTeacher) {
                                  theTeacher.name= teacher.name;
                                  theTeacher.save();
                              }
                          });
                        }
                        */

                      }
                    }
                  }
              }
          }
        }
        log("teachers: " +JSON.stringify(dbRecord.teachers));




        dbRecord.organizers = [];
        lifeCycleElement= metadata.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","lifeCycle")[0];
        if(lifeCycleElement){
          // find all contributors with role 'content provider'
          contributorsElements = lifeCycleElement.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","contribute");
          if(contributorsElements){
              for(i=0;i<contributorsElements.length;i++){
                  // just add content providers
                  role=contributorsElements[i].getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","role")[0];
                  if(role){
                    var value=null;
                    try {
                      value= role.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","value")[0].childNodes[0].nodeValue;
                    } catch(e) {}
                    var vcard=null;

                    if(value === 'content provider'){
                      try {
                          vcard=contributorsElements[i].getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","entity")[0].childNodes[0].nodeValue;
                      } catch(e){}

                      if(vcard){
                        var lines =vcard.split("\r\n");
                        for(j=0;j<lines.length;j++){
                            if(lines[j].indexOf('ORG:')==0){
                              var org= lines[j].substr(4);
                              if(org !== ''){
                                  dbRecord.organizers.push(org);
                              }
                            }
                        }
                      }
                    }
                  }
              }
          }
        }

        log("organizers: " +JSON.stringify(dbRecord.organizers));


        // find area of interest
        dbRecord.interestArea = null;
        classificationElement= metadata.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","classification")[0];
        if(classificationElement){
          // find purpose with value 'discipline'
          purposeElement = classificationElement.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","purpose")[0];
          if(purposeElement){
            var value=null;
            try {
              value= purposeElement.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","value")[0].childNodes[0].nodeValue;
            } catch(e) {}
            if(value === 'discipline'){
              try {
                  dbRecord.interestArea=classificationElement.getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","taxonPath")[0].getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","taxon")[0].getElementsByTagNameNS("http://ltsc.ieee.org/xsd/LOM","id")[0].childNodes[0].nodeValue;
                  // strip spaces: ECO: ES  --) ECO:ES
                  dbRecord.interestArea.replace(/\s+/g, '');
              } catch(e){}
            }
          }
        }
        log("area: " +JSON.stringify(dbRecord.interestArea));


        // courseimage
        var imageUrl=null;
        var imageB64=null;
        courseImageElement= metadata.getElementsByTagNameNS("http://www.ecolearning.eu/xsd/LOM","courseImage")[0];
        debugger;
        if(courseImageElement){
            courseUrlElement= courseImageElement.getElementsByTagNameNS("http://www.ecolearning.eu/xsd/LOM","courseUrl")[0];
            if(courseUrlElement && courseUrlElement.childNodes[0] && courseUrlElement.childNodes[0].nodeType==3){
              // image is a url
              imageUrl=courseUrlElement.childNodes[0].nodeValue;
            } else {
              imageB64Element= courseImageElement.getElementsByTagNameNS("http://www.ecolearning.eu/xsd/LOM","courseImageBase64")[0];
              if(imageB64Element && imageB64Element.childNodes[0] && imageB64Element.childNodes[0].nodeType==3){
                  // image is embedded base64 data
                  imageB64 = imageB64Element.childNodes[0].nodeValue;
              }
            }
        }
        //console.log("image: " +imageUrl + imageB64);
        getImageBuffer(imageUrl,imageB64)
        .then(function(buf){
          debugger;
          dbRecord.imageBuffer = new Buffer(buf.length);
          buf.copy(dbRecord.imageBuffer);
          self.emit('parseResultReady',dbRecord);
        })
        .fail(function(){
          debugger;
          dbRecord.imageBuffer = null;
          self.emit('parseResultReady',dbRecord);
        })
      } catch(e){
        log('ERROR: catch error:' + e, true);
        self.emit('harvestNextTarget');
      }
  }





    function updateCourseFields(theCourse,dbRecord){
      theCourse.identifier = {
              catalog : dbRecord.lomIdentifier.catalog,
              entry :dbRecord.lomIdentifier.entry,
      };

      theCourse.title = [];
      dbRecord.lomTitles.forEach(function(element, index, array){
          theCourse.title.push(element);
      });

      theCourse.description = [];
      dbRecord.lomDescriptions.forEach(function(element, index, array){
          theCourse.description.push(element);
      });

      theCourse.language = [];
      dbRecord.lomLanguage.forEach(function(element, index, array){
          theCourse.language.push(element);
      });

      theCourse.courseUrl =dbRecord.lomLocation;
      theCourse.typicalLearningTime =dbRecord.lomTypicalLearningTime;
      theCourse.nrOfUnits =dbRecord.nrOfUnits;
      theCourse.startDate =dbRecord.startDate;
      theCourse.endDate =dbRecord.endDate;
      theCourse.studyLoad=dbRecord.studyLoad;
      theCourse.organizers = dbRecord.organizers;
      theCourse.courseGroup = dbRecord.courseGroup;

      theCourse.teachers = [];
      dbRecord.teachers.forEach(function(element, index, array){
          theCourse.teachers.push(element);
      });

      theCourse.interestArea = dbRecord.interestArea;
    }




};

// start the process.....
if(fs.existsSync('inProcessHarvestOai') ){
        exit('Semaphore present. Quiting...');
} else {
      // set sempafhore...
      fs.closeSync(fs.openSync('inProcessHarvestOai', 'w'));
      util.inherits(PageProcessor, EventEmitter);
      PageProcessor = new PageProcessor();
      PageProcessor.harvest();
      return;
}



function cleanUp(str){
  clean = sanitizeHtml(str, {
    allowedTags: [ 'a' ],
    allowedAttributes: {
    }
  });

  //remove rubbish characters
  clean = clean.replace(/\t/g, '');  // tabs


  // convert \r\n to <br>
  clean = clean.replace(/\r\n/g, '<br>');
  clean = clean.replace(/\r/g, '<br>');
  clean = clean.replace(/\n/g, '<br>');
  clean = clean.replace(/(\s)+/g, ' ');  //multiple spaces into one
  clean = clean.trim(); // remove start and end whitespace

  return clean;
}

function getImageBuffer(imageUrl,imageB64){
    debugger;
    var deferred = Q.defer();

    if(imageUrl!=null){
      request({encoding:null,url:imageUrl}, function (error, response, body) {
        // body is a buffer, due to encoding=null
        if (!error && response.statusCode == 200) {
            //var buf=new Buffer(body,'base64');
            if(body.length < 20){  // no bullshit
                deferred.reject();
            } else {
                deferred.resolve(body);
            }
        } else {
            deferred.reject();
        }
      });
    } else if(imageB64 !=null){
            var buf=new Buffer(imageB64,'base64');
            if(buf.length < 20){  // no bullshit
                deferred.reject();
            } else {
                deferred.resolve(buf);
            }
    } else {
        deferred.reject();
    }

    return deferred.promise;
}

function removeWhitespace(xml){
    for (var i=0;i<xml.childNodes.length; i++) {
	    var currentNode = xml.childNodes[i];
	    if (currentNode.nodeType == 1){
		 	 removeWhitespace(currentNode);
		 } else if (!(/\S/.test(currentNode.nodeValue)) && (currentNode.nodeType == 3)){
		 	 xml.removeChild(xml.childNodes[i--]);
		 }
    }
}

function exit(msg){
  log(msg,true);
  mongoose.disconnect();
  // delete sempaphore...
  fs.unlinkSync('inProcessHarvestOai');
  process.exit(code=0);
}


function updateOaiMetaData(theCourse){
    var deferred = Q.defer();
    var c = theCourse.toObject();

    // determine hash of fields that are used in oai listrecords result
    var oaiImportant = {};
    oaiImportant.oaiPmhIdentifier = c.oaiPmhIdentifier;
    oaiImportant.deleted = c.deleted
    oaiImportant.identifier = c.identifier
    oaiImportant.title = [];
    for(var i=0;i<c.title.length;i++){
        oaiImportant.title.push(c.title[i].string)
    }
    oaiImportant.description = [];
    for(var i=0;i<c.description.length;i++){
        oaiImportant.description.push(c.description[i].string)
    }

    oaiImportant.language = c.language;

    oaiImportant.teachers = [];
    for(var i=0;i<c.teachers.length;i++){
        oaiImportant.teachers.push(c.teachers[i].name);
    }

    oaiImportant.startDate = c.startDate;
    oaiImportant.endDate = c.endDate;
    oaiImportant.nrOfUnits = c.nrOfUnits;
    oaiImportant.interestArea = c.interestArea;
    oaiImportant.courseUrl = c.courseUrl;
    oaiImportant.typicalLearningTime = c.typicalLearningTime;
    oaiImportant.studyLoad = c.studyLoad;
    oaiImportant.courseGroup = c.courseGroup;

    log(JSON.stringify(oaiImportant),true);

    // calculate new hash value of this record
    var recordHash = hash(oaiImportant,{
        algorithm : 'md5',
        encoding : 'hex',
    });
    log('Hash: ' + recordHash);

    if(theCourse.courseHash !== recordHash){
        log('Change in OAI metadata',true);

        theCourse.lastModificationTimestamp = new Date();
        theCourse.courseHash = recordHash;

        theCourse.save(function(err, theCourse){
            if(err){
                log(err,true);
            }
            deferred.resolve();
        });
    } else {
        log('No change in OAI metadata',true);
        deferred.resolve();
    }

    /*
    // find record
    models.OaiPMHMetaData.findOne({
        oaiPmhIdentifier: dbRecord.oaiPmhIdentifier,
        courseHash: recordHash
    }).exec(function(err, theOaiMetaData){
        if(err){
            deferred.resolve();
            return;
        }
        if(!theOaiMetaData){  // the metadata has changed or was not present before
            log('Adding new OAI metadata',true);
            var theOaiMetaData = new models.OaiPMHMetaData();

            theOaiMetaData.oaiPmhIdentifier = dbRecord.oaiPmhIdentifier;
            theOaiMetaData.courseHash = recordHash;
            theOaiMetaData.lastModificationTimestamp = new Date();

            if(!theCourse){
                theOaiMetaData._course = null;
                theOaiMetaData.deleted =  true;
            } else {
                theOaiMetaData._course = theCourse._id;
                theOaiMetaData.deleted = (dbRecord.dbAction === 'delete');
                theOaiMetaData.identifier = theCourse.identifier;
                theOaiMetaData.title  = theCourse.title;
                theOaiMetaData.description = theCourse.description;
                theOaiMetaData.language = theCourse.language;
                theOaiMetaData.teachers = theCourse.teachers;
                theOaiMetaData.startDate = theCourse.startDate;
                theOaiMetaData.endDate = theCourse.endDate;
                theOaiMetaData.nrOfUnits = theCourse.nrOfUnits;
                theOaiMetaData.interestArea = theCourse.interestArea;
                theOaiMetaData.courseUrl =theCourse.courseUrl;
                theOaiMetaData.typicalLearningTime  =theCourse.typicalLearningTime;
                theOaiMetaData.organizers=theCourse.organizers;
                theOaiMetaData.studyLoad=theCourse.studyLoad;
                theOaiMetaData.courseGroup= theCourse.courseGroup;
                theOaiMetaData.courseImageName = theCourse.courseImageName;
            }


            theOaiMetaData.save(function(err, theOaiMetaData){
                if(err){
                    log(err,true);
                }
                deferred.resolve();
            })
        } else {
            log('No change in OAI metadata',true);
        }
    });

    */

    return deferred.promise;
}
