Router.configure({
  layoutTemplate: 'layout',
  // loadingTemplate: 'loading',
  waitOn: function() { 
    return Meteor.subscribe('tickets');
  }
});

TicketsListController = RouteController.extend({
  template: 'ticketsList',
  findOptions: function() {
	  if (this.pass !== undefined) {
		  return {pass: this.pass};
	  }
	  else if (this.devEmail) {
	  	  return {devEmail: {$ne: this.devEmail()}};
	  }
	  else if (this.incomplete) {
		  return {incomplete: true};
	  }
	  return {};
  },
  data: function() {
    return {
      tickets: Tickets.find(this.findOptions()),
	  route: this.path
    };
  }
});

PassedTicketsListController = TicketsListController.extend({
	pass: true
});

FailedTicketsListController = TicketsListController.extend({
	pass: false
});

IncompleteTicketsListController = TicketsListController.extend({
	incomplete: true
});

TodoTicketsListController = TicketsListController.extend({
	devEmail: function() { return Meteor.user().emails[0].address}
});

Router.map(function() {
	this.route('ticketsList', {
		path: '/',
		controller: TicketsListController
	});
	
	this.route('passed', {
		path: '/passed',
		controller: PassedTicketsListController
	});
	
	this.route('failed', {
		path: '/failed',
		controller: FailedTicketsListController
	});
	
	this.route('incomplete', {
		path: '/incomplete',
		controller: IncompleteTicketsListController
	});
	
	this.route('toDo', {
		path: '/to-do',
		controller: TodoTicketsListController
	});	
	
	this.route('ticketPage', {
		path: '/tickets/:_id',
		waitOn: function() {
			return Meteor.subscribe('testscripts', this.params._id);
		},
		data: function() { 
			return Tickets.findOne(this.params._id) 
		}
	});
	
	this.route('ticketEdit', {
		path: '/tickets/:_id/edit',
		data: function() {
			return Tickets.findOne(this.params._id);
		}
	});
	
	this.route('ticketNew', {
		path: '/new-ticket'
	});
});

Router.before(function() { clearErrors() });