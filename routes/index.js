var uuid = require('uuid');

module.exports = function (app) {
  /*
  * GET home page.
  */
  app.get("/", function (req, res) {
    var currentUser = req.query.user;
    if (!currentUser) {
      currentUser = uuid.v4();
    };
    res.render('index', {
      title: 'webrtc-meeting',
      user: currentUser
    });
  });
};
