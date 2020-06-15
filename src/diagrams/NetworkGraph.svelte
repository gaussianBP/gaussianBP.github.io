<script>
	import { onMount } from 'svelte';

	import { scaleLinear, scaleOrdinal } from 'd3-scale';
	import { schemeCategory10 } from 'd3-scale-chromatic';
	import { select, selectAll } from 'd3-selection';
	import { drag } from 'd3-drag';
	import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force';

	import {event as currentEvent} from 'd3-selection'  // Needed to get drag working, see: https://github.com/d3/d3/issues/2733
	let d3 = { scaleLinear, scaleOrdinal, schemeCategory10, select, selectAll, drag,  forceSimulation, forceLink, forceManyBody, forceCenter }

	export let graph;

	let svg;
	let width = 500;
	let height = 600;

	$: d3yScale = scaleLinear()
		.domain([0, height])
		.range([height, 0]);

	$: links = graph.links.map(d => Object.create(d));
	$: nodes = graph.nodes.map(d => Object.create(d));  

	const colourScale = d3.scaleOrdinal(d3.schemeCategory10);

	onMount(network);

	function resize() {
		({ width, height } = svg.getBoundingClientRect());
	}

	let simulation
	function dragstarted() {
		if (!currentEvent.active) simulation.alphaTarget(0.3).restart();
		currentEvent.subject.fx = currentEvent.subject.x;
		currentEvent.subject.fy = currentEvent.subject.y;
	}

	function dragged() {
		currentEvent.subject.fx = currentEvent.x;
		currentEvent.subject.fy = currentEvent.y;
	}

	function dragended() {
		if (!currentEvent.active) simulation.alphaTarget(0);
		currentEvent.subject.fx = null;
		currentEvent.subject.fy = null;
	}

	function dragsubject() {
		return simulation.find(currentEvent.x, currentEvent.y);
	}

	function network() {
		resize()

		simulation = d3.forceSimulation(nodes)
			.force("link", d3.forceLink(links).id(d => d.id))
			.force("charge", d3.forceManyBody())
			.force("center", d3.forceCenter(width / 2, height / 2))
			.on('tick', function ticked() {		
						simulation.tick()
						nodes = [...nodes]
				links = [...links]
					});
		d3.select(svg)
			.call(d3.drag()
				.container(svg)
				.subject(dragsubject)
				.on("start", dragstarted)
				.on("drag", dragged)
				.on("end", dragended));
	}
</script>

<svelte:window on:resize='{resize}'/>

<svg bind:this={svg}>
  
	{#each links as link}
    <g stroke='#999' stroke-opacity='0.6'>
      <line x1='{link.source.x}' y1='{d3yScale(link.source.y)}' 
            x2='{link.target.x}' y2='{d3yScale(link.target.y)}'
            transform='translate(0 {height}) scale(1 -1)'>
            <title>{link.source.id}</title>
      </line>
    </g>
	{/each}

	{#each nodes as point}
    <circle class='node' r='5' fill='{colourScale(point.group)}' cx='{point.x}' cy='{d3yScale(point.y)}'
     transform='translate(0 {height}) scale(1 -1)'>
    <title>{point.id}</title></circle>
	{/each}

</svg>

<style>
	svg {
		width: 100%;
		height: 100%;
		float: left;
	}

	circle {
		stroke: #fff;
    	stroke-width: 1.5;
	}
</style>