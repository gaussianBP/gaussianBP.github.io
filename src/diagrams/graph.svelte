<script>
	import Graph from './NetworkGraph.svelte';
	// import data from './gbp2d_nonlinear.svelte';
	import data from './fg_data.js';

	data.nodes.push({id: "cam1", group: 2})
	data.links.push({source: "Myriel", target: "cam1"})

	console.log(data)
</script>

<style>
	.chart {
	  width: 100%;
	  height: 500px;
/*		width: 100%;
		height:100%;
		max-width: 640px;
		height: calc(100% - 4em);
		min-height: 280px;
		max-height: 480px;
		margin: 0 auto;*/
	}
</style>

<div class="chart">
	<Graph graph={data}/>
</div>