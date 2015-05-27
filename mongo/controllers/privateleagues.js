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
var async = require('async');

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
                    username:   foundUser.username,
                    userpic:    foundUser.pic,
                    overallSeasonScore:      foundUser.overallSeasonScore,
                    roundScores:    foundUser.roundScores,
                    status:     'admin'
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
    PrivateLeague.find({'members.user_id': user_id},
        function (err, privateLeagues) {
            if (err || privateLeagues == null) {
                console.log("There was an error retrieving private leagues: " + err);
                return res.jsonp(err);
            } else {
                console.log("Now iterating through private leagues to get up to date member info: " + JSON.stringify(privateLeagues));

                //use async recursive loop with a callback
                _fetchLeagueDetails(0, privateLeagues, function(privateLeaguesWithDetails, user_id){

                    console.log("The private league with up to date member details are now: \n" + JSON.stringify(privateLeagues))

                    return res.jsonp(privateLeaguesWithDetails);
                });

                ////Need to get updated info for all members of the private league before returning
                //var privateLeaguesToUpdate = privateLeagues;
                //console.log("Now iterating through private leagues to get up to date member info: " + JSON.stringify(privateLeagues));
                //
                ////asynchrously get all member details
                //async.each(privateLeagues, function(privateLeague){
                //    //aync loop over all members to get info
                //    async.each(privateLeague.members, function(member) {
                //
                //        //For each member find the user details and update the member object.
                //        User.findOne({'user_id' : member.user_id}, 'username score pic', function(err, result){
                //            //error checking
                //            if (err || result == null) {
                //                console.log("Error finding the member to retrieve details");
                //            } else {
                //                //update member values
                //                member.username = result.username;
                //                member.OverallSeasonScore = 9000;//result.score;
                //                member.RoundScores = [{ roundNo: 1, roundScore: 9002}];
                //                member.pic = result.pic;
                //            }
                //        });
                //    }, function(err){
                //        if (err) console.log(err);
                //    })
                //}, function(err){
                //    if (err) {
                //        console.log(err);
                //        return res.jsonp(err);
                //    } else {
                //        res.jsonp(privateLeagues);
                //    }
                //});


                //within this loop, for each private league loop over members - get up to date info for each

                //return res.jsonp(privateLeagues);
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
                username: user.pic,
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


//todo: implement mechanisms for setting and changing the league owners or "captains", admins ("vice captains") and members

//RECURSIVE ASYNC LOOP to get the member details that are up to date for a given private league
function _fetchLeagueDetails(i, privateLeagues, callback) {
    if (i < privateLeagues.length) {
        //place the current user's predictions into an array
        var memberIds = _.pluck(privateLeagues[i].members, 'user_id');

        //Retrieve user's with these ids
        User.find( {'user_id': { $in: memberIds }}, function(error, users){
            if (error || users == null) {
                console.log("There was a problem finding member details for the private leagues.");
            } else {
                //update private league's members list
                //console.log("\n \n List of users is: " + JSON.stringify(users) + '\n');

                for (var j = 0; j < privateLeagues[i].members.length; j++) {
                    var currentMember = privateLeagues[i].members[j];
                    //console.log("\n Now trying to update: " + JSON.stringify(currentMember));

                    for (var k = 0; k < users.length; k++) {

                        if (currentMember.user_id == users[k].user_id) {
                            privateLeagues[i].members[j].username = users[k].username;
                            privateLeagues[i].members[j].overallSeasonScore = users[k].overallSeasonScore;//9001;
                            privateLeagues[i].members[j].roundScores = users[k].roundScore;
                            privateLeagues[i].members[j].pic = users[k].pic;

                            //console.log("\nmember is now: " + JSON.stringify(privateLeagues[i].members[j]));

                            break; //break out of inner loop, iterate
                        }
                    }
                }

                //Once all of the members have been updated, sort them descending based on score
                var sortedMembers = _.sortBy(privateLeagues[i].members, 'score');
                sortedMembers.reverse();
                privateLeagues[i].members = sortedMembers;

                //once current private league has had all member league details found, iterate
                _fetchLeagueDetails(i + 1, privateLeagues, callback)
            }
        });
    } else {
        //if the recursion should have ended as all user's given scores, run the callback.
        callback(privateLeagues);
    }
}

