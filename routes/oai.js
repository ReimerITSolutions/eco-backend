var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var moment=require('moment');
var cors = require('cors');
var Q = require('q');
var async = require('async');
var xmlescape = require('xml-escape');
var sanitizeHtml = require('sanitize-html');
var mongoose = require('mongoose');


var appSettings = require('../appSettings.js');

module.exports = function(app){
    app.get('/oai', function(req, res,next){
        log('GET /oai',true);
        log('query: ' + JSON.stringify(req.query),true);

        if(req.query.verb==='ListRecords'){
            var metadataPrefix = req.query.metadataPrefix;
            if(!(metadataPrefix === 'oai_lom' || metadataPrefix === 'oai_dc')){
                return returnErrorResponse(req,res,'cannotDisseminateFormat');
            }

            var setSpec = req.query.set||false;

            var from = req.query.from;
            if(from){
                from = moment.utc(from);
                if(!from.isValid()){
                    return returnErrorResponse(req,res,'badArgument');
                }
            } else {
                from = moment.utc("01-01-1900", "MM-DD-YYYY");
            }

            var until = req.query.until;
            if(until){
                if(until.indexOf('T')== -1){ // if until has no time part, set it to 23:59:59.999
                    until = until.substr(0,10) + "T23:59:59.999Z";
                } else { // if until has a time part, set the milliseconds to 999
                    until = until.substr(0,19) + ".999Z";
                }
                until = moment.utc(until);

                if(!until.isValid()){
                    return returnErrorResponse(req,res,'badArgument');
                }
            } else {
                until = moment.utc();
            }

            if(from.isAfter(until)){
                    req.query.from=from.format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]");
                    req.query.until=until.format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]");
                    return returnErrorResponse(req,res,'badArgument');
            }

            listRecords(req,metadataPrefix, setSpec, from, until)
            .then(function(xml){
                res.set({'Content-Type': 'text/xml'});
                res.send(xml);
            });
        } else if(req.query.verb==='Identify'){
            return identify(req,res);
        } else if(req.query.verb==='ListMetadataFormats'){
            listMetadataFormats(req)
            .then(function(xml){
                res.set({'Content-Type': 'text/xml'});
                res.send(xml);
            });
        } else if(req.query.verb==='ListIdentifiers'){
            var metadataPrefix = req.query.metadataPrefix;
            if(!(metadataPrefix === 'oai_lom' || metadataPrefix === 'oai_dc')){
                return returnErrorResponse(req,res,'cannotDisseminateFormat');
            }

            var setSpec = req.query.set||false;

            var from = req.query.from;
            if(from){
                from = moment.utc(from);
                if(!from.isValid()){
                    return returnErrorResponse(req,res,'badArgument');
                }
            } else {
                from = moment.utc("01-01-1900", "MM-DD-YYYY");
            }

            var until = req.query.until;
            if(until){
                if(until.indexOf('T')== -1){ // if until has no time part, set it to 23:59:59.999
                    until = until.substr(0,10) + "T23:59:59.999Z";
                } else { // if until has a time part, set the milliseconds to 999
                    until = until.substr(0,19) + ".999Z";
                }
                until = moment.utc(until);

                if(!until.isValid()){
                    return returnErrorResponse(req,res,'badArgument');
                }
            } else {
                until = moment.utc();
            }

            if(from.isAfter(until)){
                    req.query.from=from.format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]");
                    req.query.until=until.format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]");
                    return returnErrorResponse(req,res,'badArgument');
            }


            listIdentifiers(req, metadataPrefix, setSpec, from, until)
            .then(function(xml){
                res.set({'Content-Type': 'text/xml'});
                res.send(xml);
            });
        } else if(req.query.verb==='ListSets'){
            listSets(req)
            .then(function(xml){
                res.set({'Content-Type': 'text/xml'});
                res.send(xml);
            });
        } else if(req.query.verb==='GetRecord'){
            var metadataPrefix = req.query.metadataPrefix;
            if(!(metadataPrefix === 'oai_lom' || metadataPrefix === 'oai_dc')){
                return returnErrorResponse(req,res,'cannotDisseminateFormat');
            }
            var identifier = req.query.identifier;
            if((!identifier) || (identifier==='')){
                return returnErrorResponse(req,res,'badArgument');
            }
            getRecord(identifier,metadataPrefix)
                .then(function(xml){
                    res.set({'Content-Type': 'text/xml'});
                    res.send(xml);
                });
        } else {
            returnErrorResponse(req,res,'badVerb');
        }








    });



}


function listRecords(req, metadataPrefix, setSpec, from, until){
    var deferred = Q.defer();

    var findObject ={
        $and: [
                {courseHash: {$ne: null}},
                {interestArea: {$ne: null}},
                {lastModificationTimestamp: {$gte: from.toDate()}},
                {lastModificationTimestamp: {$lte: until.toDate()}},
        ]
    }

    if (setSpec){
        if(setSpec.toLowerCase()==='ecobase'){
            findObject.$and.push({courseGroup: {$ne:null}});
        } else if(setSpec.toLowerCase()==='ecouser'){
            findObject.$and.push({courseGroup: {$eq:null}});
        } else {
            // do not return any record
            findObject ={
                courseHash: '-1'
            }
        }
    }
    log(JSON.stringify(findObject));

    models.EcoCourse.find(findObject).sort({lastModificationTimestamp:1}).lean().exec(function(err, courses){
        async.mapSeries(courses,
            function(course, callback){
                //log(JSON.stringify(course))

                async.parallel([
                    function(callback){
                        createRecordHeader(course)
                        .then(function(xml){
                            callback(null,xml);
                        })
                        .fail(function(){
                            callback(null,'');
                        });

                    },
                    function(callback){
                        createRecordMetaData(course, metadataPrefix)
                        .then(function(xml){
                            callback(null,xml);
                        })
                        .fail(function(){
                            callback(null,'');
                        });
                    },
                ],
                function(err, results){
                    if(err){
                        callback(null,'');
                    } else {
                        callback(null,results[0]+results[1]);
                    }
                });
            },

            function(err, results){
                var xml = '<?xml version="1.0" encoding="UTF-8"?>';
                xml += '<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:lom="http://ltsc.ieee.org/xsd/LOM" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd http://ltsc.ieee.org/xsd/LOM https://standards.ieee.org/downloads/LOM/lomv1.0/xsd/lomLoose.xsd">';
                xml += '<responseDate>'+ moment.utc().format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]") + '</responseDate>';
                xml += '<request metadataPrefix="'+ metadataPrefix + '" verb="ListRecords" ';

                if(setSpec){
                   xml += 'set="' + setSpec +'" ';
                }

                if(req.query.from){
                    xml += 'from="' + req.query.from +'" ';
                }

                if(req.query.until){
                    xml += 'until="' + req.query.until +'" ';
                }


                xml += '>';
                xml += appSettings.oaiEndpoint;
                xml += '</request>';
                xml += '<ListRecords>';
                for(var i=0;i<results.length;i++){
                    xml += '<record>';
                    xml += results[i];
                    xml += '</record>';
                }
                xml += '</ListRecords>';
                xml += '</OAI-PMH>';
                deferred.resolve(xml);
            }
        );

    });


    return deferred.promise;
}


function getRecord(identifier,metadataPrefix) {
    var deferred = Q.defer();
    log(identifier);

    models.EcoCourse.findOne({$and : [{courseHash: {$ne: null}}, {$or: [{oaiPmhIdentifier: identifier},{oaiPmhIdentifier: identifier.substr(4)}]} ]})
    .lean().exec(function(err, theCourse){
        if(theCourse){
            async.parallel([
                function(callback){
                    createRecordHeader(theCourse)
                    .then(function(xml){
                        callback(null,xml);
                    })
                    .fail(function(){
                        callback(null,'');
                    });

                },
                function(callback){
                    createRecordMetaData(theCourse, metadataPrefix)
                    .then(function(xml){
                        callback(null,xml);
                    })
                    .fail(function(){
                        callback(null,'');
                    });
                },
            ],
            function(err, results){
                if(err){
                    deferred.resolve('');
                } else {
                    var xml = '<?xml version="1.0" encoding="UTF-8"?>';
                    xml += '<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:lom="http://ltsc.ieee.org/xsd/LOM" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd  http://ltsc.ieee.org/xsd/LOM https://standards.ieee.org/downloads/LOM/lomv1.0/xsd/lomLoose.xsd">';
                    xml += '<responseDate>'+ moment.utc().format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]") + '</responseDate>';
                    xml += '<request verb="GetRecord" ' + 'identifier="' + identifier + '" metadataPrefix="' + metadataPrefix + '" >';
                    xml += appSettings.oaiEndpoint;
                    xml += '</request>';
                    xml += '<GetRecord>';
                    xml += '<record>';
                    xml += results[0]+results[1];
                    xml += '</record>';
                    xml += '</GetRecord>';
                    xml += '</OAI-PMH>';
                    deferred.resolve(xml);
                }
            });

        } else {
            // TODO: return error
                var xml = '<?xml version="1.0" encoding="UTF-8"?>';
                xml += '<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">';
                xml += '<responseDate>'+ moment.utc().format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]") + '</responseDate>';
                xml += '<request verb="GetRecord" ' + 'identifier="' + identifier + '" metadataPrefix="' + metadataPrefix + '" >';
                xml += appSettings.oaiEndpoint;
                xml += '</request>';
                xml += '<GetRecord>';
                xml += '<record>';
                xml += '</record>';
                xml += '</GetRecord>';
                xml += '</OAI-PMH>';
                deferred.resolve(xml);
        }
    });


    return deferred.promise;
}



function createRecordMetaData(ecoCourse, metadataPrefix){
    var deferred = Q.defer();
    if(ecoCourse.deleted){
        deferred.resolve('');
    } else {
        var xml='<metadata>';

        if(metadataPrefix==='oai_dc'){
            xml += '<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">'

            for (var i = 0;i < ecoCourse.title.length;i++){
                xml += '<dc:title xml:lang="' + ecoCourse.title[i].language + '">';
                xml += xmlescape(stripHtml(ecoCourse.title[i].string));
                xml += '</dc:title>';
            }


            for (var i = 0;i < ecoCourse.description.length;i++){
                xml += '<dc:description xml:lang="' + ecoCourse.description[i].language + '">';
                xml += xmlescape(stripHtml(ecoCourse.description[i].string));
                xml += '</dc:description>';
            }

            if(ecoCourse.language){
                for (var i = 0;i < ecoCourse.language.length;i++){
                    xml += '<dc:language>' + ecoCourse.language[i] + '</dc:language>';
                }
            }


            if(ecoCourse.courseUrl){
                xml += '<dc:identifier>' + xmlescape(stripHtml(ecoCourse.courseUrl)) + '</dc:identifier>';
            }


            // teachers....
            if(ecoCourse.teachers && ecoCourse.teachers.length > 0){
                for(var i=0;i<ecoCourse.teachers.length;i++){
                    xml += '<dc:creator>';
                    xml += xmlescape(stripHtml(ecoCourse.teachers[i].name));
                    xml += '</dc:creator>';
                }
            }

            // organizers....
            if(ecoCourse.organizers && ecoCourse.organizers.length > 0){
                for(var i=0;i<ecoCourse.organizers.length;i++){
                    xml += '<dc:publisher>';
                    xml += xmlescape(stripHtml(ecoCourse.organizers[i]));
                    xml += '</dc:publisher>';
                }
            }

            if(ecoCourse.startDate){
                xml+= '<dc:date>' + moment.utc(ecoCourse.startDate).format("YYYY-MM-DD") + '</dc:date>';
            } else {
                xml+= '<dc:date>' + moment.utc(ecoCourse.lastModificationTimestamp).format("YYYY-MM-DD") + '</dc:date>';
            }

            xml+= '<dc:type>' + 'MOOC' + '</dc:type>';







            xml +='</oai_dc:dc>';


        } else if(metadataPrefix==='oai_lom'){
            xml += '<lom:lom xmlns:lom="http://ltsc.ieee.org/xsd/LOM" xmlns:eco="http://www.ecolearning.eu/xsd/LOM" >';
            xml += '<lom:general>';
            xml += '<lom:identifier><lom:catalog>' + xmlescape(ecoCourse.identifier.catalog) + '</lom:catalog><lom:entry>' + xmlescape(ecoCourse.identifier.entry) + '</lom:entry></lom:identifier>';
            xml += '<lom:title>';
            for (var i = 0;i < ecoCourse.title.length;i++){
                xml += '<lom:string language="' + ecoCourse.title[i].language + '">';
                xml += xmlescape(stripHtml(ecoCourse.title[i].string));
                xml += '</lom:string>';
            }
            xml += '</lom:title>';

            if(ecoCourse.language){
                for (var i = 0;i < ecoCourse.language.length;i++){
                    xml += '<lom:language>' + ecoCourse.language[i] + '</lom:language>';
                }
            }


            xml += '<lom:description>';
            for (var i = 0;i < ecoCourse.description.length;i++){
                xml += '<lom:string language="' + ecoCourse.description[i].language + '">';
                xml += xmlescape(stripHtml(ecoCourse.description[i].string));
                xml += '</lom:string>';
            }
            xml += '</lom:description>';

            if(ecoCourse.startDate){
                xml+= '<eco:startDate>' + moment.utc(ecoCourse.startDate).format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]") + '</eco:startDate>';
            }

            if(ecoCourse.endDate){
                xml+= '<eco:endDate>' + moment.utc(ecoCourse.endDate).format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]") + '</eco:endDate>';
            }

            if(ecoCourse.nrOfUnits){
                xml+= '<eco:nrOfUnits>' + Math.round(ecoCourse.nrOfUnits) + '</eco:nrOfUnits>';
            }

            // studyload
            if(ecoCourse.studyLoad){
                xml += '<eco:studyLoad>'+ Math.round(ecoCourse.studyLoad) +'</eco:studyLoad>';
            }

            xml += '</lom:general>';

            xml += '<lom:lifeCycle>';
            // teachers....
            if(ecoCourse.teachers && ecoCourse.teachers.length > 0){
                for(var i=0;i<ecoCourse.teachers.length;i++){
                    xml += '<lom:contribute><lom:role><lom:source>LOMv1.0</lom:source><lom:value>author</lom:value></lom:role>';
                    xml += '<lom:entity><![CDATA[BEGIN:VCARD' + "\r\n" + 'FN:' + xmlescape(stripHtml(ecoCourse.teachers[i].name)) + "\r\n" + 'VERSION:3.0' + "\r\n" + 'END:VCARD]]>' + '</lom:entity>';
                    xml += '</lom:contribute>';
                }
            }

            // organizers....
            if(ecoCourse.organizers && ecoCourse.organizers.length > 0){
                for(var i=0;i<ecoCourse.organizers.length;i++){
                    xml += '<lom:contribute><lom:role><lom:source>LOMv1.0</lom:source><lom:value>content provider</lom:value></lom:role>';
                    xml += '<lom:entity><![CDATA[BEGIN:VCARD' + "\r\n" + 'ORG:' + xmlescape(stripHtml(ecoCourse.organizers[i])) + "\r\n" + 'VERSION:3.0' + "\r\n" + 'END:VCARD]]>' + '</lom:entity>';
                    xml += '</lom:contribute>';
                }
            }

            xml += '</lom:lifeCycle>';


            // area of interest...
            if(ecoCourse.interestArea){
                xml += '<lom:classification><lom:purpose><lom:source>LOMv1.0</lom:source><lom:value>discipline</lom:value></lom:purpose>';
                xml += '<lom:taxonPath><lom:source><lom:string language="en">ECO Area of Interests</lom:string></lom:source><lom:taxon>';
                xml += '<lom:id>'+ecoCourse.interestArea+'</lom:id><lom:entry><lom:string language="en">';
                if(ecoCourse.interestArea === 'ECO:ES'){
                    xml +='Educational sciences';
                } else if(ecoCourse.interestArea === 'ECO:SS'){
                    xml +='Social sciences';
                } else if(ecoCourse.interestArea === 'ECO:HUM'){
                    xml +='Humanities';
                } else if(ecoCourse.interestArea === 'ECO:NSM'){
                    xml +='Natural sciences and Mathematics';
                } else if(ecoCourse.interestArea === 'ECO:BS'){
                    xml +='Biomedical Sciences';
                } else if(ecoCourse.interestArea === 'ECO:TS'){
                    xml +='Technological sciences';
                } else {
                    xml +='Unknown';
                }

                xml += '</lom:string></lom:entry></lom:taxon></lom:taxonPath>';
                xml += '</lom:classification>';
            }

            // course url
            if(ecoCourse.courseUrl){
                xml += '<lom:technical><lom:location>' + xmlescape(stripHtml(ecoCourse.courseUrl)) + '</lom:location></lom:technical>';
            }

            //typicalLearningTime
            if(ecoCourse.typicalLearningTime){
                xml += '<lom:educational><lom:typicalLearningTime><lom:duration>' + ecoCourse.typicalLearningTime + '</lom:duration></lom:typicalLearningTime></lom:educational>';
            }




            xml += '</lom:lom>';

        } else {
        }

        xml += '</metadata>';
        deferred.resolve(xml);
    }

    return deferred.promise;
}

function createRecordHeader(ecoCourse){
    var deferred = Q.defer();

    if(ecoCourse.deleted){
        var xml='<header status="deleted">';
    } else {
        var xml='<header>';
    }

    xml += '<identifier>' + fixURN(ecoCourse.oaiPmhIdentifier) + '</identifier>';
    xml += '<datestamp>' + moment.utc(ecoCourse.lastModificationTimestamp).format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]") + '</datestamp>';

    if(!ecoCourse.deleted){
        if(ecoCourse.courseGroup){  // if it's filled it should be filled with 'EcoBase'.
            xml += '<setSpec>' + 'EcoBase' +'</setSpec>';
        } else {
            // if it's not filled it means its an e-teacher mooc
              xml += '<setSpec>' + 'EcoUser' +'</setSpec>';
        }

    }

    xml += '</header>';
    deferred.resolve(xml);

    return deferred.promise;
}

function stripHtml(str){
  clean = sanitizeHtml(str, {
      allowedTags: [],
      allowedAttributes: []
  });
  return clean;
}

function fixURN(oaiPmhIdentifier){
    if(oaiPmhIdentifier.substr(0,4) !== 'oai:'){
        oaiPmhIdentifier = 'oai:' + oaiPmhIdentifier;
    }

    return oaiPmhIdentifier;
}



function identify(req,res){

    if(Object.keys(req.query).length != 1){
        returnErrorResponse(req,res,'badArgument')
    } else {
        var repositoryName='EcoProject',
        protocolVersion='2.0',
        deletedRecord='transient',
        granularity='YYYY-MM-DDThh:mm:ssZ',
        adminEmail='integrate@ecolearning.eu';

        getEarliestDatestamp()
        .then(function(earliestDatestamp){
            var xml = '<?xml version="1.0" encoding="UTF-8"?>';
            xml += '<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">';
            xml += '<responseDate>'+ moment.utc().format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]") + '</responseDate>';

            xml += '<request verb="Identify">'+appSettings.oaiEndpoint+'</request>';
            xml += '<Identify>';
            xml += '<repositoryName>' + repositoryName + '</repositoryName>';
            xml += '<baseURL>' + appSettings.oaiEndpoint + '</baseURL>';
            xml += '<protocolVersion>'+protocolVersion+'</protocolVersion>';
            xml += '<adminEmail>' + adminEmail + '</adminEmail>';
            xml += '<earliestDatestamp>'+earliestDatestamp+'</earliestDatestamp>';
            xml += '<deletedRecord>'+ deletedRecord +'</deletedRecord>';
            xml +='<granularity>'+granularity+'</granularity>';
            xml += ' </Identify>';
            xml += '</OAI-PMH>';
            res.set({'Content-Type': 'text/xml'});
            res.send(xml);
        });

    }
}



function listMetadataFormats(req){
    var deferred = Q.defer();

    var repositoryName='EcoProject',
    baseURL=appSettings.oaiEndpoint,
    protocolVersion='2.0',
    earliestDatestamp="2016-10-05T11:21:43.256Z",
    deletedRecord='transient',
    granularity='YYYY-MM-DDThh:mm:ssZ',
    adminEmail='k.loozen@reimeritsolutions.nl';

    var xml = '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/  http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">';
    xml += '<responseDate>'+ moment.utc().format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]") + '</responseDate>';
    xml += '<request verb="ListMetadataFormats">'+baseURL+'</request>';
    xml += '<ListMetadataFormats>';

    xml += '<metadataFormat><metadataPrefix>oai_lom</metadataPrefix>';
    xml += '<schema>https://standards.ieee.org/downloads/LOM/lomv1.0/xsd/lomLoose.xsd</schema>';
    xml += '<metadataNamespace>http://ltsc.ieee.org/xsd/LOM</metadataNamespace>';
    xml += '</metadataFormat>';

    xml += '<metadataFormat>';
    xml += '<metadataPrefix>oai_dc</metadataPrefix>';
    xml += '<schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>';
    xml += '<metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace>';
    xml += '</metadataFormat>';
    xml += '</ListMetadataFormats>';
    xml += '</OAI-PMH>';



    deferred.resolve(xml);

    return deferred.promise;

}



function listSets(req){
    var deferred = Q.defer();
    var baseURL=appSettings.oaiEndpoint;

    var xml = '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/  http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">';
    xml += '<responseDate>'+ moment.utc().format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]") + '</responseDate>';
    xml += '<request verb="ListSets">'+baseURL+'</request>';
    xml += '<ListSets>';
    xml += '<set>';
    xml += '<setSpec>EcoBase</setSpec> <setName>ECO core project MOOC</setName>';
    xml += '</set>';
    xml += '<set>';
    xml += '<setSpec>EcoUser</setSpec> <setName>ECO E-Teacher MOOC</setName>';
    xml += '</set>';
    xml += '</ListSets>';
    xml += '</OAI-PMH>';



    deferred.resolve(xml);

    return deferred.promise;

}



function listIdentifiers(req, metadataPrefix, setSpec,from, until){
    var deferred = Q.defer();
    var baseURL=appSettings.oaiEndpoint;


    var findObject ={
        $and: [
                {courseHash: {$ne: null}},
                {interestArea: {$ne: null}},
                {lastModificationTimestamp: {$gte: from.toDate()}},
                {lastModificationTimestamp: {$lte: until.toDate()}},
        ]
    }

    if (setSpec){
        if(setSpec.toLowerCase()==='ecobase'){
            findObject.$and.push({courseGroup: {$ne:null}});
        } else if(setSpec.toLowerCase()==='ecouser'){
            findObject.$and.push({courseGroup: {$eq:null}});
        } else {
            // do not return any record
            findObject ={
                courseHash: '-1'
            }
        }
    }

    models.EcoCourse.find(findObject).lean().exec(function(err, courses){
        async.mapSeries(courses,
            function(course, callback){
                async.parallel([
                    function(callback){
                        createRecordHeader(course)
                        .then(function(xml){
                            callback(null,xml);
                        })
                        .fail(function(){
                            callback(null,'');
                        });

                    },
                ],
                function(err, results){
                    if(err){
                        callback(null,'');
                    } else {
                        callback(null,results[0]);
                    }
                });
            },

            function(err, results){
                var xml = '<?xml version="1.0" encoding="UTF-8"?>';
                xml += '<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd" >';
                xml += '<responseDate>'+ moment.utc().format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]") + '</responseDate>';
                xml += '<request metadataPrefix="'+ metadataPrefix + '" verb="ListIdentifiers" ';

                if(setSpec){
                   xml += 'set="' + setSpec +'" ';
                }

                if(req.query.from){
                    xml += 'from="' + req.query.from +'" ';
                }

                if(req.query.until){
                    xml += 'until="' + req.query.until +'" ';
                }

                xml += '>';
                xml += appSettings.oaiEndpoint;
                xml += '</request>';



                xml += '<ListIdentifiers>';
                for(var i=0;i<results.length;i++){
                    xml += results[i];
                }
                xml += '</ListIdentifiers>';
                xml += '</OAI-PMH>';
                deferred.resolve(xml);
            }
        );

    });


    return deferred.promise;
}

function returnErrorResponse(req,res,errorCode){
    var xml = '<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">';
    xml += '<responseDate>'+ moment.utc().format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]") + '</responseDate>';

    if(errorCode=='badVerb'){
        xml += '<request>'+appSettings.oaiEndpoint+'</request>';
    } else {
        xml += '<request ';
        for (var key in req.query) {
            xml += key + '="' + req.query[key] + '" ';
        }
        xml += '>'+appSettings.oaiEndpoint+'</request>';
    }

    if(errorCode=='badVerb'){
        xml += '<error code="badVerb">Illegal OAI verb</error>';
    }

    if(errorCode=='badArgument'){
        xml += '<error code="badArgument">Bad argument</error>';
    }

    if(errorCode=='cannotDisseminateFormat'){
        xml += '<error code="cannotDisseminateFormat">The metadata format identified by the value given for the metadataPrefix argument is not supported by this repository.</error>';
    }


    xml += '</OAI-PMH>';

    res.set({'Content-Type': 'text/xml'});
    res.send(xml);

}

function getEarliestDatestamp(){
    var deferred = Q.defer();
    models.EcoCourse.findOne({courseHash: {$ne: null}}).sort({lastModificationTimestamp:1}).exec(
      function(err, theCourse){
          deferred.resolve(moment.utc(theCourse.lastModificationTimestamp).format("YYYY-MM-DD[T]HH[:]mm[:]ss[Z]"));
      }
    );

    return deferred.promise;


}
