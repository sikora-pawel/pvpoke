<?php require_once 'header.php'; ?>

<h1>Ranker Full - Complete Matchup Data</h1>
<div class="section white">
	
	<h3>Select Cup/Format:</h3>
	<select class="format-select">
		<option value="" disabled selected>Loading cups...</option>
	</select>
	
	<p></p>
	<p><strong>This ranker generates FULL matchup matrices</strong> for all Pokemon in the selected format, not just top 5 matchups/counters.</p>
	<p>Rankings will be saved to the '/data/rankings/{cup}/full/' directory with complete matchup data for use in external applications like pogo_teambuilder.</p>
	<p>⚠️ <strong>Warning:</strong> This process generates much larger files than normal rankings and may take longer. Use for development and data export purposes.</p>

	<div style="margin: 20px 0; text-align: center;">
		<button class="button simulate">Simulate Selected Cup</button>
		<button class="button simulate-all" style="margin-left: 10px; background: #e67e22;">🚀 Generate All Cups (Batch)</button>
	</div>
	
	<div class="batch-status" style="display: none; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
		<h4>Batch Progress:</h4>
		<div class="progress-bar" style="width: 100%; height: 30px; background: #e0e0e0; border-radius: 5px; overflow: hidden; margin: 10px 0;">
			<div class="progress-fill" style="width: 0%; height: 100%; background: #27ae60; transition: width 0.3s;"></div>
		</div>
		<div class="status-text">Ready to start...</div>
		<div class="current-cup" style="margin-top: 10px; font-weight: bold;"></div>
	</div>

	<div class="output"></div>
</div>

<?php require_once 'modules/scripts/battle-scripts.php'; ?>

<script src="js/GameMaster.js?v=2"></script>
<script src="js/pokemon/Pokemon.js?v=2"></script>
<script src="js/interface/RankerInterface.js?v=2"></script>
<script src="js/interface/RankerInterfaceDebug.js"></script>
<script src="js/battle/rankers/RankerFull.js"></script>

<script>
// Override to use RankerFull instead of RankerMaster
var RankerMaster = RankerMasterFull;

// Function to convert JSON to SQLite after saving
function convertToSQLite(cup, league, callback) {
	console.log("🔄 Converting to SQLite...");
	
	$.ajax({
		url: 'data/convert_to_sqlite.php',
		type: 'POST',
		data: {
			cup: cup,
			league: league
		},
		dataType: 'json',
		success: function(result) {
			console.log("🔍 Conversion result:", result);
			
			if(result.success) {
				console.log("✅ SQLite conversion complete!");
				console.log("   DB: " + result.dbSize);
				console.log("   Compressed: " + result.gzSize);
				console.log("");
				console.log("📦 Ready for deployment:");
				console.log("   - " + result.dbFile);
				console.log("   - " + result.gzFile + " ⭐");
				console.log("");
				
				if(callback) callback(true);
			} else {
				console.error("❌ SQLite conversion failed:", result.error);
				if(result.output) {
					console.error("Output:", result.output);
				}
				if(result.debug) {
					console.error("Debug info:", result.debug);
				}
				console.log("💡 You can convert manually:");
				console.log("   cd src/data");
				console.log("   php json_to_sqlite.php rankings/" + cup + "/full/rankings-" + league + ".json");
				
				if(callback) callback(false);
			}
		},
		error: function(xhr, status, error) {
			console.error("❌ Failed to call conversion script:", error);
			console.log("💡 You can convert manually:");
			console.log("   cd src/data");
			console.log("   php json_to_sqlite.php rankings/" + cup + "/full/rankings-" + league + ".json");
			
			if(callback) callback(false);
		}
	});
}

// Batch processing variables
var batchQueue = [];
var batchCurrentIndex = 0;
var batchInProgress = false;

// Process all cups in batch
function processBatch() {
	if(batchCurrentIndex >= batchQueue.length) {
		console.log("");
		console.log("🎉 BATCH COMPLETE! All cups processed!");
		console.log("📦 Generated " + batchQueue.length + " full matchup rankings");
		console.log("");
		console.log("Next steps:");
		console.log("  cd /Users/pawelsikora/pvpoke");
		console.log("  git add src/data/rankings/*/full/");
		console.log("  git commit -m \"Add full matchup rankings for all active cups\"");
		console.log("  git push origin master");
		console.log("");
		
		// Update progress bar to 100%
		$('.progress-fill').css('width', '100%');
		$('.batch-status .status-text').html('✅ <strong>Complete!</strong> All ' + batchQueue.length + ' cups processed. Check console for details.');
		$('.batch-status .current-cup').text('');
		$('.simulate-all').prop('disabled', false).text('🚀 Generate All Cups (Batch)');
		batchInProgress = false;
		return;
	}
	
	var item = batchQueue[batchCurrentIndex];
	// Progress should show CURRENT cup being processed (1-based counting)
	var progress = Math.round(((batchCurrentIndex + 1) / batchQueue.length) * 100);
	
	$('.progress-fill').css('width', progress + '%');
	$('.status-text').html('Processing cup ' + (batchCurrentIndex + 1) + ' of ' + batchQueue.length + '...');
	$('.current-cup').text('🏆 ' + item.title);
	
	console.log("");
	console.log("═══════════════════════════════════════════════════");
	console.log("🏆 CUP " + (batchCurrentIndex + 1) + "/" + batchQueue.length + ": " + item.title);
	console.log("═══════════════════════════════════════════════════");
	console.log("");
	
	// Set the format - need to select by BOTH cup AND cp (or leagueId for main leagues)
	var $option;
	
	if(item.leagueId) {
		// Main league - use data-league-id
		$option = $('.format-select option[data-league-id="' + item.leagueId + '"]');
	} else {
		// Specialty cup - use cup name (unique)
		$option = $('.format-select option[cup="' + item.cup + '"]');
	}
	
	if($option.length > 0) {
		console.log("🔍 Before selection:");
		console.log("   Target cup: " + item.cup + ", CP: " + item.cp);
		console.log("   Option found: " + $option.text());
		console.log("   Option attr cup: " + $option.attr('cup'));
		console.log("   Option attr value: " + $option.attr('value'));
		
		// CRITICAL: Don't use .val() - it will select the FIRST option with that value (Great League!)
		// Just select the specific option and trigger change
		$('.format-select option').prop('selected', false); // Clear all
		$option.prop('selected', true);                      // Select our specific option
		$('.format-select').trigger('change');
		
		console.log("📝 After trigger change - selected option:");
		console.log("   Text: " + $('.format-select option:selected').text());
		console.log("   Cup attr: " + $('.format-select option:selected').attr('cup'));
		console.log("   Value: " + $('.format-select option:selected').val());
	} else {
		console.error("❌ Failed to find option for: " + JSON.stringify(item));
	}
	
	// Simulate (wait for format to be set)
	setTimeout(function() {
		// Debug: Check what battle CP is set to
		var interfaceInst = InterfaceMaster.getInstance();
		console.log("🔍 Debug - Triggering simulation...");
		
		$('.simulate').trigger('click');
		
		// Move to next after delay (estimate based on cup size)
		// We'll move to next when current finishes (monitored by success callback)
		waitForCompletion(item);
	}, 1000); // Increased delay to ensure change event completes
}

function waitForCompletion(item) {
	// Listen for completion event from ranker
	var completionHandler = function(event, data) {
		console.log("✅ Cup complete: " + data.cup);
		
		// Remove this specific handler
		$(document).off('rankingComplete', completionHandler);
		
		// Move to next cup
		batchCurrentIndex++;
		processBatch();
	};
	
	$(document).on('rankingComplete', completionHandler);
	
	// Fallback timeout in case something goes wrong
	var timeout = 600000; // 10 minutes max per cup
	
	setTimeout(function() {
		$(document).off('rankingComplete', completionHandler);
		
		console.warn("⚠️  Timeout reached for " + item.title + ", moving to next cup");
		
		batchCurrentIndex++;
		processBatch();
	}, timeout);
}

// Populate dropdown with ACTIVE cups only (from formats.json)
var allCupsData = []; // Store for batch processing

$(document).ready(function(){
	var $select = $('.format-select');
	
	console.log('Loading active cups from formats.json...');
	
	// Load formats.json (contains only active/visible cups)
	$.ajax({
		url: 'data/gamemaster/formats.json',
		dataType: 'json',
		success: function(formats) {
			console.log('Formats loaded:', formats);
			
			// Clear loading option
			$select.empty();
			
			// Build allCupsData for batch processing
			allCupsData = [];
			
			// Add main leagues first
			$select.append('<optgroup label="Main Leagues">');
			
			// Note: All three use cup="all" but different CP limits
			// Add data-league-id to distinguish them in dropdown
			var mainLeagues = [
				{cup: 'all', leagueId: 'great', title: 'Great League', cp: 1500},
				{cup: 'all', leagueId: 'ultra', title: 'Ultra League', cp: 2500},
				{cup: 'all', leagueId: 'master', title: 'Master League', cp: 10000}
			];
			
			for(var i = 0; i < mainLeagues.length; i++) {
				var league = mainLeagues[i];
				$select.append(
					'<option value="' + league.cp + '" cup="' + league.cup + '" data-league-id="' + league.leagueId + '">' + 
					league.title + ' (' + league.cp + ' CP)</option>'
				);
				allCupsData.push(league);
			}
			
			$select.append('</optgroup>');
			
			// Filter only active cups (showFormat = true, exclude custom)
			var activeCups = formats.filter(function(f) {
				return f.showFormat === true && f.cup !== 'custom' && f.cup !== 'all';
			});
			
			if(activeCups.length > 0){
				$select.append('<optgroup label="Active Specialty Cups">');
				
				for(var i = 0; i < activeCups.length; i++){
					var format = activeCups[i];
					
					$select.append(
						'<option value="' + format.cp + '" cup="' + format.cup + '">' + 
						format.title + ' (' + format.cp + ' CP)</option>'
					);
					
					allCupsData.push({
						cup: format.cup,
						title: format.title,
						cp: format.cp
					});
				}
				
				$select.append('</optgroup>');
				
				console.log('✅ Loaded ' + allCupsData.length + ' total cups for batch processing');
			}
		},
		error: function(xhr, status, error) {
			console.error('❌ Failed to load formats.json:', error);
			$select.empty();
			$select.append('<option value="">Error loading cups</option>');
		}
	});
	
	// Batch processing button
	$('.simulate-all').on('click', function() {
		if(batchInProgress) {
			alert('Batch processing already in progress!');
			return;
		}
		
		if(allCupsData.length === 0) {
			alert('No cups loaded yet. Please wait for formats to load.');
			return;
		}
		
		var confirm = window.confirm(
			'This will generate full matchup rankings for ALL ' + allCupsData.length + ' cups.\n\n' +
			'Estimated time: ' + Math.round(allCupsData.length * 1.5) + ' minutes\n\n' +
			'The process will run automatically. Do NOT close this page!\n\n' +
			'Continue?'
		);
		
		if(!confirm) return;
		
		console.log("");
		console.log("🚀 STARTING BATCH PROCESSING");
		console.log("📋 " + allCupsData.length + " cups to process");
		console.log("");
		
		batchQueue = allCupsData.slice(); // Copy array
		batchCurrentIndex = 0;
		batchInProgress = true;
		
		$('.batch-status').show();
		$('.simulate-all').prop('disabled', true).text('⏳ Processing...');
		
		processBatch();
	});
});
</script>

<script src="js/RankerMain.js"></script>

<?php require_once 'footer.php'; ?>

