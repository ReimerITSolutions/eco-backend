var async=require('async');
var mongoose = require('mongoose');
var Q = require( "q" );

var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var utils=require('../utils.js');
var wpposthandling=require('../wpposthandling.js');


module.exports = function(app){
    var apiResult = {
        code:'200',
        message:'OK'
    };

    app.get('/advertisements', function(req, res,next){
      log('GET /advertisements');

      var language='en';
      try {
          language=req.query.lang.toLowerCase();
      } catch (e) {}

      if (language!=='en' && language!=='de' && language!=='pt' && language!=='es' && language!=='fr' && language!=='it'){
          language='en';
      }

      // find advertisements that are available
      models.Advertisement.find({active:true}).exec(function(err, advertisements){
          async.map(advertisements,
              function(advertisement, callback){
                  if(advertisement.translationId){
                        // get the content from the translations database
                        models.Translation.findOne({id:advertisement.translationId}).exec(function(err, theTranslation){
                            if(theTranslation){
                                var content = utils.getTranslation(theTranslation.toObject().translations, language);
                                callback(null,{
                                    advertisementNr:advertisement.advertisementNr,
                                    forcePopup: advertisement.forcePopup,
                                    //content: content,
                                    translationId: advertisement.translationId,
                                });
                            } else {
                              callback({})
                            }
                        });
                    } else if(advertisement.wpPostId){
                        // get the content from wordpress
                        wpposthandling.getWpPost(advertisement.wpPostId, language)
                        .then(function(post){
                                callback(null,{
                                    advertisementNr:advertisement.advertisementNr,
                                    forcePopup: advertisement.forcePopup,
                                    content: post.html,
                                });
                        })
                        .fail(function(){
                              callback({});
                        })
                    }

              },
              function(err, results){
                  return res.json({
                    lang: language,
                    adverts: results
                  });
              }
          );
      });
    });



    app.get('/showAdvertPopup', function(req, res,next){
          log('GET /showAdvert');
          log('sub: ' + req.query.sub);
          log('id: '+req.query.id);

          models.EcoUser.findOne({_id: req.query.sub}).exec(function(err, theUser){
              if(err || !theUser){
                  return res.json({showPopup: false});
              }
              models.AdvertisementsPerUser.findOne({
                  advertisementNr: req.query.id,
                  _user: req.query.sub,
              }, function(err, theAdvertisementPerUser){
                  if(theAdvertisementPerUser){
                      return res.json({showPopup: theAdvertisementPerUser.showPopup});
                  } else {
                      return res.json({showPopup: true});
                  }
              });

          });

    });

    app.post('/updateAdvertStats', function(req, res,next){
          log('POST /updateAdvertStats');
          log('sub: ' + req.body.sub);
          log('id: '+req.body.id);

          models.AdvertisementsPerUser.findOne({
                  advertisementNr: req.body.id,
                  _user: req.body.sub,
              }, function(err, theAdvertisementPerUser){
                  if(!err){
                      if(!theAdvertisementPerUser){
                          // update view stats
                          theAdvertisementPerUser = new models.AdvertisementsPerUser;
                          theAdvertisementPerUser._user = req.body.sub;
                          theAdvertisementPerUser.advertisementNr = req.body.id;
                          theAdvertisementPerUser.shownOn = [new Date()];
                          theAdvertisementPerUser.showPopup = true;
                      } else {
                          theAdvertisementPerUser.shownOn.push(new Date());
                      }

                      // specific per-advertisement handling
                      if(theAdvertisementPerUser.advertisementNr === 1){  // office365 advert
                          // an extra data element contains the chosen button on the advert
                          if (req.body.data){
                              if(req.body.data.answer && req.body.data.answer==='y'){  // yes, user already requested license. Do not show popup any more
                                  theAdvertisementPerUser.showPopup = false;
                              }
                              if(req.body.data.answer && req.body.data.answer==='l'){  // 'No, maybe later'. Show popup again next time.
                                  theAdvertisementPerUser.showPopup = true;
                              }

                          }
                      }




                      theAdvertisementPerUser.save();
                  }

                  return res.send('ok');
              });
    });


}


/*
                    models.AdvertisementsPerUser.findOne({
                        advertisementNr: advertisement.advertisementNr,
                        _user: req.params.sub,
                    }, function(err, theAdvertisementPerUser){
                        if(err){
                            log(err);
                            callback(err,null);
                        } else if(!theAdvertisementPerUser){
                            // update view stats
                            theAdvertisementPerUser = new models.AdvertisementsPerUser;
                            theAdvertisementPerUser._user = req.params.sub;
                            theAdvertisementPerUser.advertisementNr = advertisement.advertisementNr;
                            theAdvertisementPerUser.shownOn = [new Date()];
                            theAdvertisementPerUser.show=true;
                            theAdvertisementPerUser.save();

                            callback(null,{
                                advertisementNr: advertisement.advertisementNr,
                                show: true,
                            });
                        } else if(!theAdvertisementPerUser.show){
                            callback(null,{
                                advertisementNr: advertisement.advertisementNr,
                                show: false,
                            });
                        } else {
                            theAdvertisementPerUser.shownOn.push(new Date());
                            theAdvertisementPerUser.save();

                            callback(null,{
                                advertisementNr: advertisement.advertisementNr,
                                show: true,
                            });
                        }
                    });
*/
