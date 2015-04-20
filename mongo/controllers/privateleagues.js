/**
 * Created by ***REMOVED*** on 19/04/15.
 */
var mongoose = require('mongoose');
var http = require('http');
var https = require('https');
var PrivateLeague = mongoose.model('PrivateLeague');
var User = mongoose.model('User');
var ObjectId = require('mongoose').Types.ObjectId;

exports.createPrivateLeague = function(req, res){
    //Need to pass in creator user id as param
    var user_id = req.params.user_id;

    //Also, get the proposed name of the Private league as a parameter
    //TODO: Validation for this to ensure it is sensible?
    var league_name = req.params.private_league_name;

    //Construct the object to pass in to creation
    var id = mongoose.Types.ObjectId();

    var newPrivateLeague = {
        privateLeagueId: id,
        privateLeagueName: league_name,
        creator:    user_id,
        members:
            [
                {
                    user_id: user_id
                }
            ] //add the creator of the private league as a member of the private league
    };

    //Create the private league
    PrivateLeague.create(newPrivateLeague, function(err, privateLeague) {
        if(err) return console.log(err);
        return res.jsonp(202);
    });
};

//Return the private leagues that the user is a member of - includes ones created
exports.getPrivateLeagues = function(req, res){

    //Need to pass in the user_id
    var user_id = req.params.user_id;

    //Need to search the database for members arrays where user_id is present
    PrivateLeague.find({'members.user_id': user_id}, //{'members.$': 1},
        function (err, privateLeagues) {
            if (privateLeagues) {
                console.log(privateLeagues);
                return res.jsonp(privateLeagues);
            }
        }
    );

};

//TODO: Need to validate the user that is requesting the removal, ensure they are an owner/admin of the leagues
exports.removePrivateLeagueMember = function(req, res){
    //Get user_id of member to remove
    var removeUserId = req.params.remove_user_id;

    var removeUserWithObjectId = null;

    //Get the private league id
    var privateLeagueId = req.params.private_league_id;

    //Verify that the user requesting the removal is admin/owner of this private league

    //Remove the user - findOne, remove (pull), save
    PrivateLeague.findOne({'privateLeagueId' : privateLeagueId}, function(error, privateLeague){

        //check that a result has been returned, if not, send an error message
        if (privateLeague == null) {
            return res.jsonp("No such private league exists.")
        }

        //Pull this member from the array
        console.log('The corresponding private league has been successfully found: ' + privateLeague);
        console.log('Now attempting to remove the user with user_id: ' + removeUserId + ' from the Private League: ' + privateLeagueId);

        //Find the member with the corresponding user_id
        for (var i = 0; i < privateLeague.members.length; i++) {
            //if the user_id is the same as the one we want to remove, remove it

            console.log('Iterating over loop, looking for private league member with id: ' + removeUserId);

            if (privateLeague.members[i].user_id == removeUserId) {

                console.log('Private league member ' + privateLeague.members[i].user_id + ' found');

                //get the id of this member
                console.log('Getting the object id of the user to remove: ' + privateLeague.members[i]._id);
                removeUserWithObjectId = privateLeague.members[i]._id

                //Now remove the object_id
                privateLeague.members.id(removeUserWithObjectId).remove();

                //Now save the removal
                privateLeague.save(function (err) {

                    if (err) return res.jsonp(err);

                    console.log('the sub-doc was removed');

                    //return accepted status code
                    return res.jsonp(202);
                });
            }
        }
    });
};

exports.deletePrivateLeague = function(req, res){
    //Get private league id to remove

    //Remove the whole private league document
};

exports.invitePrivateLeagueMember = function(req, res){

    //URL strcture should be
    ///user/:user_id/:privateLeagueId/:invited_user_name

    //Get user_id of the user to invite based on username - if none found, invalid user name given
    var username = req.params.invited_user_name; //user name of the person we are attempting to invite
    var invitee_user_id = null;
    var user_id = req.params.user_id; //user id of the person creating the invitation

    //Validation to check that user and private league exist

    //attempt to match the user name of the invitee to a user_id
    User.findOne({'username': username}, function(err, results) {
        //Check to see if any results were found, if not, return an error

        //For debugging
        console.log('1. The user found matching the provided username is: ' + results);

        if (results == null) {
            //exit out
            console.log('No user with the provided username was found, exiting function.');
            return res.jsonp("The invited user does not exist.");
        } else {
            //assign the user id to a variable
            console.log('2. The user_id of the invited user is: ' + results.user_id);
            invitee_user_id = results.user_id;
        };

        //Get privateLeagueId of the league to which you wish to invite the user
        var privateLeagueId = req.params.private_league_id;
        var privateLeagueName = '';

        //Get the name of the private league using the privateLeagueId
        PrivateLeague.findOne({'privateLeagueId': new ObjectId(privateLeagueId)}, function(err, results){
            //Check to see if any results were found, if not, return an error

            //For debugging
            console.log('3. The private leagues found matching the provided privateLeagueId is: ' + results);

            if (results == null) {
                //exit out
                console.log('No private league with the provided private league id was found, exiting function.');
                return res.jsonp("The private league does not exist.");
            } else {
                //assign the user id to a variable
                console.log('4. The privateLeaugeId to which the user is being invited is: ' + results.privateLeagueId);
                privateLeagueName = results.privateLeagueName;
            };

            var inviting_user = null;

            //Get the username of the user who is creating the invitation
            User.findOne({'user_id': user_id}, 'username', function(error, results){
                //Check to see if any results were found, if not, return an error

                //TODO: place this repeated check logic into a function perhaps
                //For debugging
                console.log('5. The username found matching the provided user_id is: ' + results);

                if (results == null) {
                    //exit out
                    console.log('No username with the provided user_id was found, exiting function.');
                    return res.jsonp("The inviting user does not exist.");
                } else {
                    //assign the user id to a variable
                    console.log('6. The username of the inviting user is:' + results.username);
                    inviting_user = results.username;
                };

                //Print out required variables for debugging
                console.log('About to attempt update variables are:');
                console.log('inviting_user:' + inviting_user);
                console.log('privateLeagueId: ' + privateLeagueId);
                console.log('invitee_user_id: ' + invitee_user_id);
                console.log('privateLeagueName: ' + privateLeagueName);

                User.findOne({ user_id: invitee_user_id }, function (err, user){

                    console.log("7. The user about to be given an invitation is: " + user + ' and has invitations: ' + user.invitations);

                    //check that an invitation for this private league does not already exist
                    for (var i = 0; i < user.invitations.length; i++) {
                        if (user.invitations[i].privateLeagueId == privateLeagueId) {
                            //then an invite to this league already exists, so don't add another
                            console.log('The user has already been invited to this private league.');

                            return res.jsonp('The user has already been invited to join this private league');
                        }
                    }

                    user.invitations.push({
                        "invitedBy"         :  inviting_user,
                        "privateLeagueId"   :  privateLeagueId,
                        "privateLeagueName" :  privateLeagueName
                    });

                    //Save the changes to the user
                    user.save();

                    console.log("Successfully invited user " + invitee_user_id);

                    res.jsonp(202);
                });
            });
        });
    });
};

//upon accepting an invitation
exports.addPrivateLeagueMember = function(req, res){
    //Get the user_id of the invitee

    //Get the privateLeagueId of the league to which the member is being added

    //Add this user_id to the privateLeague's members array - findOne, alter, save.

    //also ADD THIS USERS NAME AND SCORE
};

