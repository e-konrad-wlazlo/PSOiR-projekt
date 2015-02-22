var express = require('express');
var router = express.Router();
var AWS = require('aws-sdk');
var AWS_CONFIG_PATH = './config.json';
var SQS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/983680736795/maciejewskiSQS';
var crypto = require('crypto');
var fs = require('fs');

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

/* GET error page. */
router.get('/error', function(req, res) {
	if(req.param("type") == 'wrongType')
		{
		  res.render('error', { message: "You may upload only jpg,bmp" });
		}  
});

/* GET Hello World page. */
router.get('/start', function(req, res) {
	
	AWS.config.loadFromPath(AWS_CONFIG_PATH);
	var S3 = new AWS.S3();

	var params = {
			  Bucket: 'piotrmaciejewski-images', /* required */
			};
	S3.listObjects(params, function(err, data) {
	 if (err) console.log(err, err.stack); // an error occurred
	 else     
		 {
		 	var filenames = []; 
		 	for(var i=0; i<data.Contents.length;i++)
		 		{
		 			filenames[i] = data.Contents[i].Key.toString();
		 		}
		 	
		 	res.render('start', { title: 'Welcome to image storage and proccesing sevice!', filenames: filenames })
		 
		 }
	});
});

/* GET Add Image page. */
router.get('/addimage', function(req, res) {
    var expiration = new Date();
    expiration.setHours(expiration.getHours() + 1);

    var policy = {
        expiration: expiration.toISOString(),
        conditions: [
            {bucket: "piotrmaciejewski-images"},
            ["starts-with", "$key", "/"],
            {acl: "private"},
            {success_action_redirect: "http://localhost:3000/start"},
            ["starts-with", "$Content-Type", "image/"],
            ["content-length-range", 0, 1048576]
        ]
    };
    
    var awsConfig = require(AWS_CONFIG_PATH);

    var awsKeyId = awsConfig.accessKeyId.toString();
    var awsKey = awsConfig.secretAccessKey.toString();

    var policyString = JSON.stringify(policy);
    var encodedPolicyString = new Buffer(policyString).toString("base64");

    var hmac = crypto.createHmac("sha1", awsKey);
    hmac.update(encodedPolicyString);

    var digest = hmac.digest('base64');
    
    var name = req.param("file");
    
    res.render('addImage', { title: 'Add Image', awskeyid: awsKeyId, policy: encodedPolicyString, signature: digest }); //, keyname: "piotr.maciejewski/"});	

});

router.get('/inspect', function(req, res) {
	
	  res.render('inspect', { file: req.param("name") });
	  
});

router.get('/action', function(req, res) {
	
	if(req.param("action") == "delete") // jesli parametr na stronie /action to "delete" (czyli w url to by bylo chyba cos takiego .../action?delete)
	{
		AWS.config.loadFromPath(AWS_CONFIG_PATH);
		var S3 = new AWS.S3();
		
		var temp = req.param("name");
		
		var params = {
				  Bucket: 'piotrmaciejewski-images', 
				  Key: temp
				};
		S3.deleteObject(params, function(err, data) {
			if (err) res.send(err);
			else     res.redirect('/start');
		});
	};
	
	if(req.param("action") == "download")
	{
		AWS.config.loadFromPath(AWS_CONFIG_PATH);
		var S3 = new AWS.S3();
		
		var temp = req.param("name");
		
		var params = {
				  Bucket: 'piotrmaciejewski-images', 
				  Key: temp
				};
		S3.getObject(params, function(err, data) {
			if (err) res.send(err);
			else     {
				fs.writeFile('./downloads/' + temp, data.toString(), function (err,data) {
					  if (err) {
						  res.send(err);
					  }
					  else
						  {
						  res.redirect('/start');
						  }
					});

			}
				
		});
	};
	
	if(req.param("action") == "changeBrighteness") // przykladowa akcja na pliku, np. zmiana jasnosci
	{
		AWS.config.loadFromPath(AWS_CONFIG_PATH);
		var sqs = new AWS.SQS();
		
		var action = req.param("action");
		
		var file = req.param("file");
		
		var value = req.param("value");
		
		var msg = file + "|" + action + "|" + value;
		
		var paramsSQSSend = {
				  MessageBody: msg, /* required */
				  QueueUrl: SQS_QUEUE_URL, /* required */
				 }
				
		
		sqs.sendMessage(paramsSQSSend, function(err, data) {
			  if (err) res.send(err);
			  else     res.redirect('/start');           
			});
		
	};

	if(req.param("action") == "deleteQueue") // usuwanie pliku za pomoca kolejki
	{
		AWS.config.loadFromPath(AWS_CONFIG_PATH);
		var sqs = new AWS.SQS();
		
		var action = req.param("action");
		
		var file = req.param("name");
		
		var msg = file + "|" + action;
		
		var paramsSQSSend = {
				  MessageBody: msg, /* required */
				  QueueUrl: SQS_QUEUE_URL, /* required */
				 }
				
		
		sqs.sendMessage(paramsSQSSend, function(err, data) { // wyslij komunikat na kolejke
			  if (err) res.send(err);
			  else     res.redirect('/start');           
			});
		
	};
	  
});

module.exports = router;
