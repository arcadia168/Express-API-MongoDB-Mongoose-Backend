module.exports = function(app){
    var fixtures = require('./mongo/controllers/fixtures');
    var users = require('./mongo/controllers/users');

    app.get('/users/:username', users.getUserData);
    app.get('/users/predictions/:username', users.getPredictions);
    app.get('/scoreboard', users.getScoreboard);
    app.get('/users/predictions/:username/:round', users.findRoundPredictions);
    app.post('/users', users.addUser);
    app.post('/users/predictions/:username/:round', users.addPredictions);
    app.put('/users/predictions/update/:username', users.updatePrediction);
    app.put('/users/:username', users.updateUser);
    app.delete('/users/predictions/clear', users.clearPredictions);
    app.delete('/users/predictions/clear/:username/:round', users.clearRoundPredictions);
    
    app.get('/dummy/users', users.dummyData)
    
    app.get('/fixtures', fixtures.getFixtures);
    app.get('/fixtures/:round', fixtures.getRound);
    app.get('/rounds', fixtures.getGroupedFixtures);
    app.post('/fixtures', fixtures.addFixtures);
    app.delete('/fixtures', fixtures.clearFixtures);
    app.delete('/fixtures/:round', fixtures.clearRound);
    
    app.get('/dummy/fixtures', fixtures.dummyData);
    
    app.delete('/clear/all', users.wipe);
}