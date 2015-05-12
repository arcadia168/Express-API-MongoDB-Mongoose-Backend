/**
 * Created by ***REMOVED*** on 19/04/15.
 */
var mongoose = require('mongoose');
var http = require('http');
var https = require('https');
var PrivateLeague = mongoose.model('PrivateLeague');
var User = mongoose.model('User');
var uuid = require('./Math.uuid'); //used to generate the unique league codes
var ObjectId = require('mongoose').Types.ObjectId;
var _ = require('underscore');

//Todo: Remove the ability to invite users privately to a league - less mess, more simplistic.
//TODO: For ALL API methods, implement error handling that does not shut down the server if something does not work
//TODO: TEST PROPERLY. mocha, karma and jasmine.

exports.createPrivateLeague = function (req, res) {
    //Need to pass in creator user id as param
    var user_id = req.params.user_id;

    //Also, get the proposed name of the Private league as a parameter
    //TODO: Validation for this to ensure it is sensible?
    var league_name = req.params.private_league_name;

    //Todo: retrieve private leagues with the same name, only continue if none exist already

    //Construct the object to pass in to creation
    var id = mongoose.Types.ObjectId();
    var leagueCode = Math.uuid(7, 10); //7 digits at base 10 should suffice, if collisions, change this

    //for debugging once sure this is all working
    console.log("The sharable open invitation league code is: " + leagueCode);

    User.findOne({"user_id": user_id}, function (error, foundUser) {

        if (foundUser == null) {
            return res.jsonp('User creating the league is invalid.')
        }

        var newPrivateLeague = {
            privateLeagueId: id,
            privateLeagueName: league_name,
            privateLeagueCode: leagueCode,
            creator: user_id,
            members: [
                {
                    user_id: user_id, //add the creator of the private league as a member of the private league
                    username: foundUser.username,
                    score: foundUser.score,
                    status: 'admin'
                }
            ]
        };

        //Create the private league
        PrivateLeague.create(newPrivateLeague, function (err, privateLeague) {
            if (err) return console.log(err);
            return res.jsonp(202);
        });
    });

};

//Return the private leagues that the user is a member of - includes ones created
exports.getPrivateLeagues = function (req, res) {

    //Need to pass in the user_id
    var user_id = req.params.user_id;

    //Need to search the database for members arrays where user_id is present
    PrivateLeague.find({'members.user_id': user_id}, 'privateLeagueId privateLeagueName', //{'members.$': 1},
        function (err, privateLeagues) {
            if (privateLeagues) {
                console.log(privateLeagues);
                return res.jsonp(privateLeagues);
            }
        }
    );

};

exports.getPrivateLeague = function (req, res) {

    //Need to pass in the user_id
    var user_id = req.params.user_id;
    var privateLeagueId = req.params.private_league_id;

    //Need to search the database for members arrays where user_id is present
    PrivateLeague.find({'privateLeagueId': privateLeagueId},
        function (err, privateLeague) {
            if (privateLeague) {
                console.log(privateLeague);
                return res.jsonp(privateLeague);
            }
        }
    );

};

exports.removePrivateLeagueMember = function (req, res) {
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
    PrivateLeague.findOne({'privateLeagueId': privateLeagueId}, function (error, privateLeague) {

        //check that a result has been returned, if not, send an error message
        if (privateLeague == null) {
            return res.jsonp("No such private league exists.")
        }

        //user rights validation occurs on the frontend and via authentication of these endpoints with auth0

        //console.log('The owner of this private league is user: ' + privateLeague.creator);
        ////ensure that the user attempting to make the change is entitle to do so
        //if (!privateLeague.creator == user_id) { //todo: make this an array of league 'admins'
        //    //if the user making the request is not the owner, they can't do this
        //    return res.jsonp(403); //code which denotes access denied
        //}

        //Pull this member from the array
        console.log('The corresponding private league has been successfully found: ' + privateLeague);
        console.log('Now attempting to remove the user with user_id: ' + removeUserId + ' from the Private League: ' +
            privateLeagueId);

        //Find the member with the corresponding user_id
        for (var i = 0; i < privateLeague.members.length; i++) {
            //if the user_id is the same as the one we want to remove, remove it

            console.log('Iterating over loop, looking for private league member with id: ' + removeUserId);

            if (privateLeague.members[i].user_id == removeUserId) {

                member_exists = true;

                console.log('Private league member ' + privateLeague.members[i].user_id + ' found');

                //get the id of this member
                console.log('Getting the object id of the user to remove: ' + privateLeague.members[i]._id);

                //TODO: Replace other removals with this methodology
                removeUserWithObjectId = privateLeague.members[i]._id;

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
        } //TODO: If not found, what to return?
    });
};

exports.deletePrivateLeague = function (req, res) {

    //get the private league id from the url params
    var privateLeagueId = req.params.private_league_id;

    //get the user_id of the user attempting to delete the private league
    var user_id = req.params.user_id;

    console.log('User ' + user_id + ' is attempting to delete the private league ' + privateLeagueId);

    //TODO: Check that the user asking to delete the private league is an admin of the private league
    PrivateLeague.findOne({'privateLeagueId': privateLeagueId}, 'creator', function (error, creator) {

        if (creator == null) {
            return;
        }

        console.log(creator);
        console.log('The creator of the private league that user is attempting to delete is: ' + creator.creator);

        //if user trying to delete is not the creator of the private league, they lack the priviledge to delete, so error
        if (creator.creator != user_id) {
            console.log('The user attempting to delete the private league with id: '
                + privateLeagueId + ' does not have sufficient priviledges');
            return res.jsonp('403'); //403 means insufficient priviledges/access denied.
        }

        //Get private league id to remove
        var remove_league = req.params.private_league_id;

        //Remove the whole private league document
        PrivateLeague.remove({'privateLeagueId': remove_league}, function (error) {
            if (error) return res.jsonp(error);

            console.log('Private League with id: ' + privateLeagueId + ' was removed');

            //return accepted status code
            return res.jsonp(202);
        });
    });
};

exports.renamePrivateLeague = function (req, res) {
    //Get the id of the private league to be renamed
    var privateLeagueId = req.params.private_league_id;

    //Get the user id of the user who is attempting to rename the private league
    var user_id = req.params.user_id;

    //Get the new name that the private league is attempting to be given
    var new_name = req.params.new_league_name;

    //Retrieve the private league with the corresponding id
    PrivateLeague.findOne({'privateLeagueId': privateLeagueId}, function (error, foundPrivateLeague) {

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
        }
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

//exports.invitePrivateLeagueMember = function (req, res) {
//
//    //URL strcture should be
//    ///user/:user_id/:privateLeagueId/:invited_user_name
//
//    //Get user_id of the user to invite based on username - if none found, invalid user name given
//    var username = req.params.invited_user_name; //user name of the person we are attempting to invite
//    var invitee_user_id = null;
//    var user_id = req.params.user_id; //user id of the person creating the invitation
//
//    //Validation to check that user and private league exist
//
//    //attempt to match the user name of the invitee to a user_id
//    User.findOne({'username': username}, function (err, results) {
//        //Check to see if any results were found, if not, return an error
//
//        //For debugging
//        console.log('1. The user found matching the provided username is: ' + results);
//
//        if (results == null) {
//            //exit out
//            console.log('No user with the provided username was found, exiting function.');
//            return res.jsonp("The invited user does not exist.");
//        } else {
//            //assign the user id to a variable
//            console.log('2. The user_id of the invited user is: ' + results.user_id);
//            invitee_user_id = results.user_id;
//        }
//        //Get privateLeagueId of the league to which you wish to invite the user
//        var privateLeagueId = req.params.private_league_id;
//        var privateLeagueName = '';
//
//        //Get the name of the private league using the privateLeagueId
//        PrivateLeague.findOne({'privateLeagueId': new ObjectId(privateLeagueId)}, function (err, foundPrivateLeague) {
//            //Check to see if any results were found, if not, return an error
//
//            //For debugging
//            console.log('3. The private leagues found matching the provided privateLeagueId is: ' + foundPrivateLeague);
//
//            if (foundPrivateLeague == null) {
//                //exit out
//                console.log('No private league with the provided private league id was found, exiting function.');
//                return res.jsonp("The private league does not exist.");
//            } else {
//                //assign the user id to a variable
//                console.log('4. The privateLeaugeId to which the user is being invited is: '
//                    + foundPrivateLeague.privateLeagueId);
//                privateLeagueName = foundPrivateLeague.privateLeagueName;
//            }
//            var inviting_user = null;
//
//            //Get the username of the user who is creating the invitation
//            User.findOne({'user_id': user_id}, 'username', function (error, foundUser) {
//                //Check to see if any results were found, if not, return an error
//
//                //TODO: place this repeated check logic into a function perhaps
//                //For debugging
//                console.log('5. The username found matching the provided user_id is: ' + foundUser);
//
//                if (results == null) {
//                    //exit out
//                    console.log('No username with the provided user_id was found, exiting function.');
//                    return res.jsonp("No user with that username was found!");
//                } else {
//                    //assign the user id to a variable
//                    console.log('6. The username of the inviting user is:' + foundUser.username);
//                    inviting_user = foundUser.username;
//                }
//                //Print out required variables for debugging
//                console.log('About to attempt update variables are:');
//                console.log('inviting_user:' + user_id);
//                console.log('privateLeagueId: ' + inviting_user);
//                console.log('invitee_user_id: ' + invitee_user_id);
//                console.log('privateLeagueName: ' + privateLeagueName);
//
//                //Now retrieve the details of the user that has been invited to join the private league
//                User.findOne({user_id: invitee_user_id}, function (err, user) {
//
//                    console.log("7. The user about to be given an invitation is: " + user + ' and has invitations: '
//                        + user.invitations);
//
//                    if (results == null) {
//                        //exit out
//                        console.log('No username with the provided user_id was found, exiting function.');
//                        return res.jsonp("No user with that username was found!");
//                    }
//
//                    //TODO: Remove these validation steps as they will have been done on the frontend
//                    //first check that a user has not invited themself
//                    if (invitee_user_id == user_id) {
//                        return res.jsonp("403 - You can not invite yourself to the league.")
//                    }
//
//                    //check that an invitation for this private league does not already exist
//                    for (var i = 0; i < user.invitations.length; i++) {
//                        if (user.invitations[i].privateLeagueId == privateLeagueId) {
//                            //then an invite to this league already exists, so don't add another
//                            console.log('The user has already been invited to this private league.');
//
//                            return res.jsonp('The user has already been added to this private league');
//                        }
//                    }
//
//                    //TODO: CHECK THAT THE USER IS NOT INVITING THEMSELF
//
//                    for (var i = 0; i < foundPrivateLeague.members; i++) {
//                        //check to see if the user being invited has already been invited
//                        if (members[i].user_id == invitee_user_id) {
//                            //then exit, as we can not re-invite the user
//                            console.log('This user has already been invited and can not be so again, exiting function');
//                            return res.jsonp('503 - User has already been invited/added to the private league');
//                        }
//                    }
//
//                    user.invitations.push({
//                        "invitedBy": inviting_user,
//                        "privateLeagueId": privateLeagueId,
//                        "privateLeagueName": privateLeagueName
//                    });
//
//                    console.log('8. Now provisionally adding this member to the private league with a status of pending');
//                    //also add this member to the private league with a status of pending
//                    foundPrivateLeague.members.push(
//                        {
//                            "user_id": invitee_user_id,
//                            "username": user.username,
//                            "status": "Invited - awaiting acceptance."
//                        }
//                    );
//
//                    console.log('Now the private league has members: ' + foundPrivateLeague.members);
//
//                    console.log("9. Saving the changes made to the private league: " + privateLeagueId);
//                    foundPrivateLeague.save();
//
//                    //Save the changes to the user
//                    user.save();
//
//                    console.log("10. Successfully invited user " + invitee_user_id);
//
//                    res.jsonp(202);
//                });
//            });
//        });
//    });
//};

exports.joinPrivateLeagueWithCode = function (req, res) {

    var leagueCode = req.params.private_league_code;
    var userId = req.params.user_id;

    //Now find the league and user and add this user to the private league's members list

    //Get user_id, username and score from user
    User.findOne({"user_id" : userId}, function(error, user){

        if (error) {
            console.log(error);
            res.jsonp("503 - An error occured locating the user"); //todo: standardise this into an object
        } else if (user == null) {
            console.log("The specified user could not be found");
            res.jsonp("404 - Could not find the user who is requesting to join the league");
        }

        //Now attempt to find the private league with the given code and add this user to it
        PrivateLeague.findOne({ "privateLeagueCode" : leagueCode}, function(error, privateLeague){

            //First check to see if there was an error
            if (error) {
                console.log(error);
                res.jsonp("503 - There was an error in attempting to locate the specified private league.")
            } else if (privateLeague == null) {
                console.log("Could not locate the private league specified");
                res.jsonp("404 - Could not locate the private league specified");
            }

            //If there was no error, now add the user to the private league and return
            console.log("The private league is: \n" + JSON.stringify(privateLeague));
            console.log("Existing members are: " + JSON.stringify(privateLeague.members));

            //construct the member object to be added to the league's members array
            var newMember = {
                user_id: userId,
                username: user.username,
                score : user.score,
                status: "Accepted" //todo: remove this when deleting private invitation mechanism
            }

            //Now add the new member into the league's members array
            privateLeague.members.push(newMember);

            //Now attempt to save the new member
            PrivateLeague.update({ "privateLeagueCode" : leagueCode}, {'members': privateLeague.members} ,function(err){
                //if there is an error, this is due to a mongo issue so simply return this to the user
                if (err) return res.jsonp(err);
                console.log('The invited member has now been added to the private league');

                //Return to the requesting client
                res.jsonp(200); //todo: make this a standardised object which gets returned
            });
        });
    });
};

//upon accepting an invitation
//exports.addPrivateLeagueMember = function (req, res) {
//    //Get the user_id of the invitee, accepting the invitation
//    var invited_user_id = req.params.invited_user_id;
//    var username = null;
//    var user_score = null;
//
//    //Get the privateLeagueId of the league to which the member is being added
//    var privateLeagueId = req.params.private_league_id;
//
//    console.log('The user_id of the user who was invited to join the private league is: ' + invited_user_id);
//    //also ADD THIS USERS NAME AND SCORE - or is this duplication of data!?
//    //nest the functions as otherwise they all run ASYNC - oh no
//    User.findOne({'user_id': invited_user_id}, function (error, foundUser) {
//        //first ensure that some results were returned
//        if (foundUser == null) {
//            console.log('Requesting user was not found on server.');
//            return res.jsonp(404); //user not found
//        }
//
//        console.log('Now attempting to assign the username: ' + foundUser.username + ' and the score ' + foundUser.score);
//        console.log('The data for the found user is: ' + JSON.stringify(foundUser));
//
//        //assign the user's username and score to variables to be stored in private league
//        username = foundUser.username;
//        user_score = foundUser.score;
//
//        //Add this user_id to the privateLeague's members array - findOne, alter, save.
//        PrivateLeague.findOne({'privateLeagueId': privateLeagueId}, 'members', function (error, members) {
//
//            //ensure that the private league the user is attempting to add a member to exists
//            if (members == null) {
//                console.log('The private league ' + privateLeagueId + ' could not be found.');
//                return res.jsonp('403 - The private league you are attempting to add a member to could not be found.');
//            } else {
//                console.log('Successfully retrieved the private league\'s members to which the user will be added: '
//                    + JSON.stringify(members.members));
//            }
//
//            var invited = false;
//
//            //ensure that the user that is attempting to be added to the private league has been invited
//            for (var i = 0; i < members.members.length; i++) {
//                //compare user_id of the member being added and if not return with an error message
//
//                console.log('Now finding the invited user to accept thier invitation, comparing ' + invited_user_id
//                    + ' to member (at index ' + i + ') ' + members.members[i].user_id);
//                if ((members.members[i].user_id == invited_user_id) && (members.members[i].status != "accepted")) {
//                    //then this person has been invited, accept
//                    invited = true;
//                    console.log('User attempting to join league has been properly invited');
//
//                    //get user to add
//                    var userToUpdate = members.members[i];
//                    console.log('Accepting invitation for the user ' + userToUpdate);
//
//                    //now removing this invitation before adding the user
//                    console.log('Now removing this user from the array, to replace with accepted user');
//                    members.members.splice(i, 1);
//
//                    //now contstruct the new member object to be added
//                    userToUpdate.status = "accepted";
//                    userToUpdate.score = user_score;
//
//                    console.log('Now adding the accepted user to the members array');
//                    //now add this member to the league in the same position
//                    members.members.splice(i, 0, userToUpdate);
//
//                    console.log('User successfully added to the private league, the new members array is: '
//                        + JSON.stringify(members.members));
//
//                    //Now save the changes into the database
//
//                    PrivateLeague.update({'privateLeagueId': privateLeagueId}, {'members': members.members}, function (err) {
//                        if (err) return res.jsonp(err);
//
//                        //once this has been accepted, remove the invitation from the user!
//                        //identify the invitatin by the privateLeagueId
//                        for (var j = 0; j < foundUser.invitations.length; j++) {
//                            //if the private league id in the invitation matches, this is the one to delete
//                            if (foundUser.invitations[j].privateLeagueId == privateLeagueId) {
//                                //then delete this invitation and save the change
//                                foundUser.invitations.splice(j, 1); //shoud remove 1 invitation at index j
//
//                                console.log('Successfully accepted the user invitation for the user ' + invited_user_id);
//
//                                //now save the changes made to the invitations
//                                User.update({'user_id': invited_user_id}, {'invitations': foundUser.invitations}, function (err) {
//                                    //if there is an error, this is due to a mongo issue so simply return this to the user
//                                    if (err) return res.jsonp(err);
//
//                                    console.log('The invitation that was accepted has now been deleted.');
//                                    //else if all that has happened and the method has still not returned, the user was not added
//                                    return res.jsonp(200);
//                                });
//                            }
//                        }
//                    });
//                } else {
//                    //return an error as this user is already a member who has accepted an invitatoin
//                    console.log("User was either not invited or had already accepted an invitation");
//                }
//            }
//        });
//    });
//};

//when a user rejects an invitation
//exports.rejectPrivateLeagueInvitation = function (req, res) {
//    //assign the url parameters to variables
//
//    //the user who is rejecting the invitation
//    var invitedUserId = req.params.invited_user_id;
//    var invitedUserName = null;
//
//    //the user who issued the invitation
//    var invitingUserName = req.params.inviting_username;
//
//    //the private league id, from which the prospective member needs to be removed
//    var privateLeagueId = req.params.private_league_id;
//    var privateLeagueName = null;
//
//    console.log("Now attempting to reject the invitation to user " + invitedUserId + " from "
//        + invitingUserName + " to " + privateLeagueId);
//
//    //TODO: Replace all of these with findOneAndUpdate method - more efficient! Look where else this could be done.
//
//    //Delete the invitation from the user and get the username
//    User.findOne({"user_id": invitedUserId}, function (error, invitedFoundUser) {
//
//        //first check to see whether or not any user was found
//        if (invitedFoundUser == null) {
//            return res.jsonp("The invited user was not found, so may have been deleted.");
//        }
//
//        //set the username to be used in the notification
//        invitedUserName = invitedFoundUser.username;
//        console.log("The username of the user who was invited is: " + invitedUserName);
//
//        //search for the invitation and splice at it's index
//        for (var i = 0; i < invitedFoundUser.invitations.length; i++) {
//            console.log("Now evaluating stored private league id: " + invitedFoundUser.invitations[i].privateLeagueId +
//                " with presented one: " + privateLeagueId);
//            if (invitedFoundUser.invitations[i].privateLeagueId == privateLeagueId) {
//                //then this is the invitation we wish to delete
//                //splice the invitation from the user's invitations array
//                console.log("Now removing the rejected invite from the user\'s invitations array");
//                invitedFoundUser.invitations.splice(i, 1);
//
//                console.log("Now saving the changes made to the user");
//
//                //now save the changes made to the invitations
//                //TODO: Go through and always use the camel caps naming convention
//                //TODO: Go through code and where possible use update statements as opposed to saves - unreliable, saves are more efficient
//                //User.update({'user_id' : invitedUserId},{ 'invitations' : invitedFoundUser.invitations}, function(err){
//                //    //if there is an error, this is due to a mongo issue so simply return this to the user
//                //    if (err) return res.jsonp(err);
//                //    console.log('The invitation that was rejected has now been deleted.');
//                //});
//                invitedFoundUser.save(function (err) {
//                    //if there is an error, this is due to a mongo issue so simply return this to the user
//                    if (err) return res.jsonp(err);
//                    console.log('The invitation that was rejected has now been deleted.');
//                });
//
//                break; //TODO: Go through code and determine where it can be made more efficient
//            }
//        }
//
//        //Delete the member from the league and get the league name
//        PrivateLeague.findOne({"privateLeagueId": privateLeagueId}, function (error, foundPrivateLeauge) {
//            //first check to see whether or not any user was found
//            if (foundPrivateLeauge == null) {
//                return res.jsonp("The private league to which the user was invited was not found, so may have been deleted.");
//            } else {
//                console.log("The found private league is: " + JSON.stringify(foundPrivateLeauge));
//            }
//
//            console.log("Now removing the member who rejected the invite from the private league");
//
//            //assign the league name to the variable for use in the notification
//            privateLeagueName = foundPrivateLeauge.privateLeagueName;
//            console.log("The name of the private league is: " + privateLeagueName);
//
//            for (var i = 0; i < foundPrivateLeauge.members.length; i++) {
//                console.log("Now evaluating stored member: " + foundPrivateLeauge.members[i].user_id +
//                    " with presented one: " + invitedUserId);
//                if (foundPrivateLeauge.members[i].user_id == invitedUserId) {
//                    //then this is the user we want to remove
//                    foundPrivateLeauge.members.splice(i, 1);
//                    console.log("The user has been removed, the members of the private league are now: "
//                        + JSON.stringify(foundPrivateLeauge.members));
//
//                    //now update the private league
//                    foundPrivateLeauge.save(function (err) {
//                        //if there is an error, this is due to a mongo issue so simply return this to the user
//                        if (err) return res.jsonp(err);
//                        console.log('The invitation that was rejected has now been deleted.');
//                    });
//
//                    break; //exit the loop
//                }
//            }
//
//            //Add a notification of rejection to the user who issued the invite
//            User.findOne({"username": invitingUserName}, function (error, invitingFoundUser) {
//
//                //first check to see whether or not any user was found
//                if (invitingFoundUser == null) {
//                    return res.jsonp("The inviting user was not found, so may have been deleted.");
//                }
//
//                //Construct the object to pass in to creation
//                var id = mongoose.Types.ObjectId();
//
//                //generate the new notification to add
//                var notification = {
//                    notificationId: id,
//                    message: "The user " + invitedUserName + " rejected the invitation from "
//                    + invitingUserName + " to join the private league " + privateLeagueName
//                };
//
//                console.log("Now pushing the new notification: " + JSON.stringify(notification)
//                    + " on the user\'s notifications");
//
//                //now splice this notification into the user's notifications
//                invitingFoundUser.notifications.push(notification);
//
//                console.log("The inviting user\'s notifications are now: " + JSON.stringify(invitingFoundUser.notifications));
//
//                //save the changes made to the user's notifications
//                invitingFoundUser.save(function (err) {
//                    //if there is an error, this is due to a mongo issue so simply return this to the user
//                    if (err) return res.jsonp(err);
//                    console.log('The invitation that was rejected has now been deleted.');
//                    //Return accepted but not processed status code TODO: Implement this in other areas of the server where necessary
//                    return res.jsonp(202);
//                });
//                //TODO: Test this method
//            });
//        });
//    });
//};

