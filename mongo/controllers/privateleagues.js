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
                    user_id: user_id //add the creator of the private league as a member of the private league
                }
            ]
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

exports.removePrivateLeagueMember = function(req, res){
    //Get user_id of member to remove
    var removeUserId = req.params.remove_user_id;

    //Get user_id of the user trying to perform the operation for validation
    var user_id = req.params.user_id;

    var removeUserWithObjectId = null;

    var member_exists = false;

    //check the user_id of the user making the request, if they are not the league owner, they cannot do this

    //Get the private league id
    var privateLeagueId = req.params.private_league_id;

    //Verify that the user requesting the removal is admin/owner of this private league

    //Remove the user - findOne, remove (pull), save
    PrivateLeague.findOne({'privateLeagueId' : privateLeagueId}, function(error, privateLeague){

        //check that a result has been returned, if not, send an error message
        if (privateLeague == null) {
            return res.jsonp("No such private league exists.")
        }

        console.log('The owner of this private league is user: ' + privateLeague.creator)
        //ensure that the user attempting to make the change is entitle to do so
        if (!privateLeague.creator == user_id) { //todo: make this an array of league 'admins', maybe, later, yeah, later.
            //if the user making the request is not the owner, they can't do this
            return res.jsonp(403) //code which denotes access denied
        }

        //Pull this member from the array
        console.log('The corresponding private league has been successfully found: ' + privateLeague);
        console.log('Now attempting to remove the user with user_id: ' + removeUserId + ' from the Private League: ' + privateLeagueId);

        //Find the member with the corresponding user_id
        for (var i = 0; i < privateLeague.members.length; i++) {
            //if the user_id is the same as the one we want to remove, remove it

            console.log('Iterating over loop, looking for private league member with id: ' + removeUserId);

            if (privateLeague.members[i].user_id == removeUserId) {

                member_exists = true;

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

        console.log('Specified user was not a member of the private league and was hence not removed, exiting.')
        return res.jsonp('member was not found in private league');
    });
};

exports.deletePrivateLeague = function(req, res){

    //get the private league id from the url params
    var privateLeagueId = req.params.private_league_id;

    //get the user_id of the user attempting to delete the private league
    var user_id = req.params.user_id;

    console.log('User ' + user_id + ' is attempting to delete the private league ' + privateLeagueId);

    //TODO: Check that the user asking to delete the private league is an admin of the private league
    PrivateLeague.findOne({ 'privateLeagueId' : privateLeagueId}, 'creator' , function(error, creator) {

        if (creator == null) {
            return;
        }

        console.log(creator);
        console.log('The creator of the private league that user is attempting to delete is: ' + creator.creator);

        //if user trying to delete is not the creator of the private league, they lack the priviledge to delete, so error
        if (creator.creator != user_id) {
            console.log('The user attempting to delete the private league with id: ' + privateLeagueId + ' does not have sufficient priviledges')
            return res.jsonp('403'); //403 means insufficient priviledges/access denied.
        };
    });

    //Get private league id to remove
    var remove_league = req.params.private_league_id;

    //Remove the whole private league document
    PrivateLeague.remove({ 'privateLeagueId' : remove_league}, function(error){
        if (error) return res.jsonp(error);

        console.log('Private League with id: ' + privateLeagueId + ' was removed');

        //return accepted status code
        return res.jsonp(202);
    });

};

exports.renamePrivateLeague = function(req, res) {
    //Get the id of the private league to be renamed
    var privateLeagueId = req.params.private_league_id;

    //Get the user id of the user who is attempting to rename the private league
    var user_id = req.params.user_id;

    //Get the new name that the private league is attempting to be given
    var new_name = req.params.new_league_name;

    //Retrieve the private league with the corresponding id
    PrivateLeague.findOne({ 'privateLeagueId' : privateLeagueId}, function(error, foundPrivateLeague){

        //check that a private league with the corresponding id was found
        if (foundPrivateLeague == null) {
            console.log("No private league with that id was found");
            res.jsonp(404);
        }

        console.log('the creator of the private league has user_id: ' + foundPrivateLeague.creator);
        console.log('user_id of the user attempting to change the league name is: ' + user_id);
        //check that the user issuing the command owns/created the private league and hence has permission
        if (foundPrivateLeague.creator != user_id) {
            //then the user making the command does not have persmission to change this private league
            console.log("the user attempting to change the name of the private league does not have sufficient priviledges as they are not the creator of the league.");
            return res.jsonp(403); //403 for permission denied
        };

        console.log('Now changing the private league with id: ' + privateLeagueId + ' to have the name: ' + new_name);
        //now that that the league exists and the user has sufficient permission to change the name, do so
        foundPrivateLeague.privateLeagueName = new_name;

        console.log('Now attempting to save the new name into the private league.' + foundPrivateLeague.privateLeagueName);
        //Now save the change to the name
        foundPrivateLeague.save(function (err) {

            if (err) return res.jsonp(err);

            console.log('The private league with id: ' + privateLeagueId + ' had its name changed to: ' + new_name);

            //return accepted status code
            return res.jsonp(202);
        });

    });
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
        PrivateLeague.findOne({'privateLeagueId': new ObjectId(privateLeagueId)}, function(err, foundPrivateLeague){
            //Check to see if any results were found, if not, return an error

            //For debugging
            console.log('3. The private leagues found matching the provided privateLeagueId is: ' + foundPrivateLeague);

            if (foundPrivateLeague == null) {
                //exit out
                console.log('No private league with the provided private league id was found, exiting function.');
                return res.jsonp("The private league does not exist.");
            } else {
                //assign the user id to a variable
                console.log('4. The privateLeaugeId to which the user is being invited is: ' + foundPrivateLeague.privateLeagueId);
                privateLeagueName = foundPrivateLeague.privateLeagueName;
            };

            var inviting_user = null;

            //Get the username of the user who is creating the invitation
            User.findOne({'user_id': user_id}, 'username', function(error, foundUser){
                //Check to see if any results were found, if not, return an error

                //TODO: place this repeated check logic into a function perhaps
                //For debugging
                console.log('5. The username found matching the provided user_id is: ' + foundUser);

                if (results == null) {
                    //exit out
                    console.log('No username with the provided user_id was found, exiting function.');
                    return res.jsonp("The inviting user does not exist.");
                } else {
                    //assign the user id to a variable
                    console.log('6. The username of the inviting user is:' + foundUser.username);
                    inviting_user = foundUser.username;
                };

                //Print out required variables for debugging
                console.log('About to attempt update variables are:');
                console.log('inviting_user:' + inviting_user);
                console.log('privateLeagueId: ' + privateLeagueId);
                console.log('invitee_user_id: ' + invitee_user_id);
                console.log('privateLeagueName: ' + privateLeagueName);

                //Now retrieve the details of the user that has been invited to join the private league
                User.findOne({ user_id: invitee_user_id }, function (err, user){

                    console.log("7. The user about to be given an invitation is: " + user + ' and has invitations: ' + user.invitations);

                    //check that an invitation for this private league does not already exist
                    for (var i = 0; i < user.invitations.length; i++) {
                        if (user.invitations[i].privateLeagueId == privateLeagueId) {
                            //then an invite to this league already exists, so don't add another
                            console.log('The user has already been invited to this private league.');

                            return res.jsonp('The user has already been added to this private league');
                        }
                    }

                    user.invitations.push({
                        "invitedBy"         :  inviting_user,
                        "privateLeagueId"   :  privateLeagueId,
                        "privateLeagueName" :  privateLeagueName
                    });

                    console.log('8. Now provisionally adding this member to the private league with a status of pending');
                    //also add this member to the private league with a status of pending
                    foundPrivateLeague.members.push(
                        {
                            "user_id"  : invitee_user_id,
                            "username" : user.username,
                            "status"   : "Invited - awaiting acceptance."
                        }
                    );

                    console.log('Now the private league has members: ' + foundPrivateLeague.members);

                    console.log("9. Saving the changes made to the private league: " + privateLeagueId);
                    foundPrivateLeague.save();

                    //Save the changes to the user
                    user.save();

                    console.log("10. Successfully invited user " + invitee_user_id);

                    res.jsonp(202);
                });
            });
        });
    });
};

//upon accepting an invitation
exports.addPrivateLeagueMember = function(req, res){
    //Get the user_id of the invitee, accepting the invitation
    var user_id = req.params.user_id;
    var username = null;
    var user_score = null;

    //Get the privateLeagueId of the league to which the member is being added
    var privateLeagueId = req.params.private_league_id;

    //also ADD THIS USERS NAME AND SCORE - or is this duplication of data!?
    User.findOne({ 'user_id' : user_id}, 'username score', function(error, results){

        //first ensure that some results were returned
        if (results == null) {
            console.log('Requesting user was not found on server.');
            return res.jsonp(404); //user not found
        };

        console.log('Now attempting to assign the username: ' + results.username + ' and the score ' + results.score);

        //assign the user's username and score to variables to be stored in private league
        username = results.username;
        user_score = results.score;
    });

    //Add this user_id to the privateLeague's members array - findOne, alter, save.
    PrivateLeague.findOne({'privateLeagueId' : privateLeagueId}, 'members', function(error, members) {

        //ensure that the private league the user is attempting to add a member to exists
        if (members == null) {
            console.log('The private league ' + privateLeagueId + ' could not be found.')
            return res.jsonp(403);
        };

        //ensure that the user that is attempting to be added to the private league has been invited
        for (var i = 0; i < members.length; i++) {
            //compare user_id of the member being added and
        };

        //construct the object to be added to the members array of the private league

        //push the new member

        //save the change made to this private league.
    });
};

