module.exports = function(app){
    var users = require('./mongo/controllers/users');
    var fixtures = require('./mongo/controllers/fixtures');
    
    app.get('/users/:username', users.getUserData);
    app.get('/users/predictions/:username', users.getPredictions);
    app.get('/users/scoreboard/', users.getScoreboard);
    app.post('/users', users.addUser);
    app.put('/users/predictions/:username', users.addPredictions);
    app.put('/users/:username', users.updateUser);
    app.delete('/users/predictions/clear', users.clearPredictions);
    
    app.get('/dummy/users', users.dummyData)
    
    app.get('/fixtures', fixtures.getFixtures);
    app.get('/fixtures/:round', fixtures.getRound);
    app.get('/rounds', fixtures.getGroupedFixtures);
    app.post('/fixtures', fixtures.addFixtures);
    app.delete('/fixtures', fixtures.clearFixtures);
    app.delete('/fixtures/:round', fixtures.clearRound);
    
    app.get('/dummy/fixtures', fixtures.dummyData);
}