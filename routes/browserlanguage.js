module.exports = function(app){
    app.get('/browserlanguage', function(req, res,next){
        var lang='en';
        if(req.headers && req.headers["accept-language"]){
          lang=req.headers["accept-language"];
        }
        res.json(lang);
    });
}

