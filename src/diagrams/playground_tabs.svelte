<script>
    import { Tabs, TabList, TabPanel, Tab } from '../utils/tabs/tabs.js';
    
  	import CustomPlayground from './pose_graph2d.svelte';
	import Robot from './robot2d.svelte';
	
</script>


<Tabs>
	<TabList>
		<Tab>Customizable 2D Pose Graphs</Tab>
		<Tab>2D Robot Simulation</Tab>
	</TabList>

	<TabPanel>
        <CustomPlayground/>
	</TabPanel>

	<TabPanel>
        <Robot/>
	</TabPanel>

</Tabs>