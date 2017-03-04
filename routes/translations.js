var log = require('../log.js');
var models=require('../models.js');


module.exports = function(app){
  app.get('/translations', function(req, res,next){
    var apiResult = {
      code:'200',
      message:'OK'
    };

    log('/get translations');
    debugger;
    log(JSON.stringify(req.query));
    if(!req.query ){
        res.json(apiResult);
        return;
    }

    var language='en';
    try {
        language=req.query.language.toLowerCase();
    } catch (e) {}
    if (language!=='en' && language!=='de' && language!=='pt' && language!=='es' && language!=='fr' && language!=='it'){
        language='en';
    }


    models.Translation.find().exec(function(err, theTranslations){
      if(theTranslations){
          var result = new Array();
          for(var i=0;i<theTranslations.length;i++){
            var enText=null;
            var langText=null;

            var translations=theTranslations[i].translations;
            for(n=0;n<theTranslations[i].translations.length;n++){
                if(theTranslations[i].translations[n].language=='en'){
                    enText = theTranslations[i].translations[n].text ||null;
                }
                if(theTranslations[i].translations[n].language==language){
                    langText = theTranslations[i].translations[n].text || null;
                }
            }

            if(!langText){
                langText=enText;
            }
            if(!langText){
                langText='unknown';
            }

            result.push({
                id: theTranslations[i].id,
                text: langText
            });
          }
          res.json(result);
      } else {
          res.json(apiResult);
      }
    });



  });
}



