var DEFAULT_TESTERS_PER_TICKET = 2;

Tickets = new Meteor.Collection('tickets');
if (Meteor.isServer) {
  // Tickets._dropIndex({ "assemblaId": 1 }, { unique: true });
}

var userIsAdmin = function() {
  if (Meteor.user()) {
    return Meteor.user().isAdmin;
  }

  return false;
}

Tickets.allow({
  update: userIsAdmin,
  remove: userIsAdmin,
  insert: userIsAdmin
});

Meteor.methods({
  resetTicketsWithoutResetingTesters: function() {
    var currentMilestone = Milestones.findOne({current: true});
    if (!currentMilestone) {
      throw new Meteor.Error(401, "Milestone not found");
    }

    Tickets.update({"fixVersion.name": currentMilestone.name},
      {$set: {passers: [], failers: [], status: '', allStepsCompleted: []}}, {multi: true});
    // set milestone id on testscripts too, so this does not update all
    Testscripts.update({},
      {$set: {passers: [], failers: [], status: ''}}, {multi: true});
  },

  resetTickets: function() {
    var currentMilestone = Milestones.findOne({current: true});
    if (!currentMilestone) {
      throw new Meteor.Error(401, "Milestone not found");
    }

    Tickets.update({"fixVersion.name": currentMilestone.name},
      {$set: {passers: [], failers: [], testers: [], status: '', allStepsCompleted: []}}, {multi: true});
    // set milestone id on testscripts too, so this does not update all
    Testscripts.update({},
      {$set: {passers: [], failers: [], status: ''}}, {multi: true});
  },

  assignTickets: function() {
    if (Meteor.isClient) {
      // results will be different on client and server due to shuffling
      // (random draw), so wait for server to get back with results
      return;
    }

    Meteor.call('resetTickets');

    var currentMilestone = Milestones.findOne({current: true});
    var testersCollection = TestingAssignments.find({milestoneName: currentMilestone.name, notTesting: {$ne: true}});

    if (testersCollection.count() < DEFAULT_TESTERS_PER_TICKET) {
      throw new Meteor.Error(401, "Please assign at least " + DEFAULT_TESTERS_PER_TICKET + " people to test");
    }

    // remove testers from all tickets with no-testing required
    Tickets.update({"fixVersion.name": currentMilestone.name, statusName: "Done", noTesting: true},
      {$set: {testers: []}},
      {multi: true});

    // get all tickets that need testers assigned
    var tickets = Tickets.find({"fixVersion.name": currentMilestone.name, statusName: "Done", noTesting: false});
    var testers = _.shuffle(testersCollection.fetch());

    tickets.forEach(function(ticket) {
      // some tickets might have a tester num override, check that here.
      var numTesters = ticket.numTesters || DEFAULT_TESTERS_PER_TICKET;
      if (numTesters >= testersCollection.count()) {
        var requiredNumTesters = parseInt(numTesters) + 1;
        var errorMessage = "Please assign more people to test. Ticket " +
          ticket.jiraId + " requires " + requiredNumTesters +
          " testers to ensure it will not be assigned to the person that fixed it.";
        throw new Meteor.Error(401, errorMessage);
      }

      var ticketTesters = [];

      while (ticketTesters.length < numTesters) {
        // reset queue of testers when empty
        if (testers.length === 0) {
          testers = _.shuffle(testersCollection.fetch());
        }

        // validate potential tester for ticket
        var potentialTester = testers.pop();
        // 1. can't test your own ticket
        if (potentialTester.name === ticket.assignedTo.name) {
          // put tester back in so testing is distributed more equally
          testers.unshift(potentialTester);
          continue;
        }

        // 2. can't test the same ticket twice
        if (_.contains(ticketTesters, potentialTester.name)) {
          // put tester back in so testing is distributed more equally
          testers.unshift(potentialTester);
          continue;
        }

        potentialTester.tickets.push(ticket);
        TestingAssignments.update(
        {milestoneName: currentMilestone.name, name: potentialTester.name},
          {$set: {tickets: potentialTester.tickets}});

        ticketTesters.push(potentialTester.name);
      }

      Tickets.update({jiraId: ticket.jiraId}, {$set: {testers: ticketTesters}});
    });
  },

  updateTickets: function() {
    if (Meteor.isServer) {
      Jira.populateTicketCollection();
    }
  }
});
