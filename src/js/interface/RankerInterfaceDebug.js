// Debug wrapper for RankerInterface - inject debug logging

$(document).ready(function() {
	// Intercept format changes
	var originalHandler = $('.format-select').data('events') ? $('.format-select').data('events').change : null;
	
	$('.format-select').on('change.debug', function() {
		var $selected = $(this).find('option:selected');
		console.log("🔍 FORMAT CHANGE EVENT:");
		console.log("   Selected text: " + $selected.text());
		console.log("   Cup attribute: " + $selected.attr('cup'));
		console.log("   CP value: " + $selected.val());
	});
});

