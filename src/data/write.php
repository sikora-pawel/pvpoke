<?php

/*
* Given JSON data, write to a file.
* This really, really, really doesn't belong in production. So watch out.
*/

// Validate that data exists and falls within the allowed parameters

if( (! isset($_POST['data'])) || (! isset($_POST['league'])) || (! isset($_POST['category'])) || (! isset($_POST['cup']))){
	exit("Data does not have valid keys.");
}

// If only there was some universal source for this info, like some kind of master file??
// But nah let's scratch our head for 20 minutes when we can't figure out why the write function doesn't work after we change a name

$leagues = [500,1500,2500,10000];
$categories = ["closers","attackers","defenders","leads","switches","chargers","consistency","overall","beaminess","full"];

if( (! in_array($_POST['league'], $leagues)) || (! in_array($_POST['category'], $categories)) ){
	exit("League or category is not valid");
}

// For "full" category, skip JSON validation to save memory (files are huge!)
// The ranker already generates valid JSON, no need to decode and re-encode
if($_POST['category'] === 'full') {
	// Just use the data as-is (string)
	$jsonData = $_POST['data'];
} else {
	// For normal rankings, validate JSON
	$json = json_decode($_POST['data']);
	
	if($json === null){
		exit("JSON cannot be decoded.");
	}
	
	$jsonData = $_POST['data'];
}

$filepath = 'rankings/' . $_POST['cup'] . '/' . $_POST['category'] . '/rankings-' . $_POST['league'] . '.json';

// Create directory if it doesn't exist
$directory = dirname($filepath);
if (!file_exists($directory)) {
	mkdir($directory, 0755, true);
}

if(file_put_contents($filepath, $jsonData) !== false){
	$fileSize = round(filesize($filepath) / 1024 / 1024, 2);
	echo '{ "status": "Success", "file": "' . $filepath . '", "size": "' . $fileSize . ' MB" }';
} else{
	echo '{ "status": "Fail", "error": "Failed to write file" }';
}

?>
