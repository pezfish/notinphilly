var mongoose            = require('mongoose');
var ToolRequestModel    = require('./toolRequest.model');
var RequestStatusModel  = require('./requestStatus.model');
var ToolsInventoryModel = require('../inventory/toolsInventory.model');

var stateConsts = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  DELIVERED: 3
};

exports.get = function(req, res, next) {
  ToolRequestModel.find({})
          .populate('user')
          .populate('tool')
          .populate('status')
          .exec(function (err, requests) {
            if (err) return res.status(500).send(err);
            res.status(200).json(requests);
          });
};

exports.countForCurrentUser = function(req, res, next) {
  if (req.user)
  {
    var userId = req.user._id.toString();

    ToolRequestModel.count({ user: mongoose.Types.ObjectId(userId), status: {'$ne': stateConsts.REJECTED}  }, function(err, count) {
                    if (err) return res.status(500).send(err);

                    return res.status(200).json({ userId: userId, count: count});
                  });
  }
  else {
    return res.status(401).send('Unauthorized');
  }
};

exports.getForUser = function(req, res, next) {
  if (req.user)
  {
    var userId = req.user._id.toString();

    ToolRequestModel.find({ user: mongoose.Types.ObjectId(userId) })
            .populate('user')
            .populate('tool')
            .populate('status')
            .exec(function (err, requests) {
              if (err) return res.status(500).send(err);

              var response = {
                pending: [],
                approved: [],
                rejected: [],
                delivered: []
              };

              for (var i = 0; i < requests.length; i++)
              {
                var request = requests[i];

                if (request.status._id === stateConsts.PENDING) response.pending.push(request);
                else if (request.status._id === stateConsts.APPROVED) response.approved.push(request);
                else if (request.status._id === stateConsts.REJECTED) response.rejected.push(request);
                else if (request.status._id === stateConsts.DELIVERED) response.delivered.push(request);
              }

              res.status(200).json(response);
            });
    }
    else {
      return res.status(401).send('Unauthorized');
    }
};

exports.getPaged = function(req, res, next) {
  var page = req.params.pageNumber;
  var skip = req.params.pageSize;
  var sortColumn = req.params.sortColumn;
  var sortDirection = req.params.sortDirection;

  var itemsToSkip = (page - 1) * skip;

  ToolRequestModel.count({}, function(err, count) {
    var query = ToolRequestModel.find({})
                .skip(itemsToSkip).limit(skip)
                .populate('user')
                .populate('tool')
                .populate('status');

    query.exec(function(err, requests) {
                  if (err) return res.status(500).send(err);

                  var data = { requests: requests, count: count};
                  res.status(200).json(data);
                });
  });
};

exports.getStatuses = function(req, res, next) {
  RequestStatusModel.find({}, function(err, statuses) {
    if (err) return res.status(500).send(statuses);

    res.status(200).json(statuses);
  });
};

exports.create = function(req, res, next) {
  if (req.user)
  {
    var userId = req.user._id.toString();
    var requestCode = req.body.code;

    ToolRequestModel.findOne({ code: requestCode }, function(err, existingToolRequest) {
      if (err) {
        console.log(err);
        return res.status(500).send('There was an issue. Please try again later');
      }

      if (existingToolRequest) {
        res.status(409).send('Tool request with this code already exists');
      }
      else {
        ToolsInventoryModel.findOne({code: requestCode}, function(err, inventoryRecord) {
          var newToolRequest = new ToolRequestModel({
            user: userId,
            tool: inventoryRecord._id
          });

          newToolRequest.save(function (err, toolRequest) {
            if (err) {
              console.log(err);
              return res.status(500).send('There was an issue. Please try again later');
            }

            res.status(200).send('Tool request was created successfully');
          });
        });
      }
    });
  }
  else {
    return res.status(401).send('Unauthorized');
  }
};

exports.update = function(req, res, next) {
  var requestId = req.body._id;

  ToolRequestModel.findById(requestId, function(err, existingToolRequest) {
    if (err) return res.status(500).send('There was an issue. Please try again later');

    if (!existingToolRequest) {
      return res.status(500).send('Tool request you trying to update does not exist');
    }
    else {
      existingToolRequest.user = req.body.user._id;
      existingToolRequest.tool = req.body.tool._id;
      existingToolRequest.status = req.body.status._id;

      existingToolRequest.save(function (err, toolRequest) {
        if (err) return res.status(500).send('There was an issue. Please try again later');

        res.status(200).send('Tool request was updated successfully');
      });
    }
  });
};

exports.changeStatus = function(req, res, next) {
  var requestId = req.body.id;

  ToolRequestModel.findById(requestId, function(err, existingToolRequest) {
    if (err) return res.status(500).send('There was an issue. Please try again later');

    if (!existingToolRequest) {
      return res.status(500).send('Tool request you trying to update does not exist');
    }
    else {
      existingToolRequest.status = req.body.status;

      existingToolRequest.save(function (err, toolRequest) {
        if (err) return res.status(500).send('There was an issue. Please try again later');

        res.status(200).send('Tool request status was updated successfully');
      });
    }
  });
};
