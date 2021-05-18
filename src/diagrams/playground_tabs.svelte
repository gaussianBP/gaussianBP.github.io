<script>
    import { Tabs, TabList, TabPanel, Tab } from '../utils/tabs/tabs.js';
    
  	import CustomPlayground from './pose_graph2d_linear.svelte';
	import Robot from './robot2d.svelte';
	
</script>

<style>

	#wrapper {
		grid-column: page;
	}

    /* #caption {
        text-align: left;
        grid-column: page;
    } */

</style>

<figure class="subgrid">

    <div id="wrapper" class="interactive-container">

		<Tabs>
			<TabList>
				<Tab>Pose Graphs</Tab>
				<Tab>Robot Simulation</Tab>
			</TabList>

			<TabPanel>
				<CustomPlayground/>
			</TabPanel>

			<TabPanel>
				<Robot/>
			</TabPanel>

		</Tabs>

    </div>

    <!-- <figcaption id="caption">
        Gaussian Belief propagation playground.
    </figcaption> -->

</figure>
