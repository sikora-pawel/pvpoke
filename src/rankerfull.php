<?php require_once 'header.php'; ?>

<h1>Ranker Full - Complete Matchup Data</h1>
<div class="section white">
	<?php require 'modules/formatselect.php'; ?>
	<p></p>
	<p><strong>This ranker generates FULL matchup matrices</strong> for all Pokemon in the selected format, not just top 5 matchups/counters.</p>
	<p>Rankings will be saved to the '/data/rankings/{cup}/full/' directory with complete matchup data for use in external applications like pogo_teambuilder.</p>
	<p>⚠️ <strong>Warning:</strong> This process generates much larger files than normal rankings and may take longer. Use for development and data export purposes.</p>

	<button class="button simulate">Simulate Full Rankings</button>

	<div class="output"></div>
</div>

<?php require_once 'modules/scripts/battle-scripts.php'; ?>

<script src="js/GameMaster.js?v=2"></script>
<script src="js/pokemon/Pokemon.js?v=2"></script>
<script src="js/interface/RankerInterface.js?v=2"></script>
<script src="js/battle/rankers/RankerFull.js"></script>

<script>
// Override to use RankerFull instead of RankerMaster
var RankerMaster = RankerMasterFull;
</script>

<script src="js/RankerMain.js"></script>

<?php require_once 'footer.php'; ?>

