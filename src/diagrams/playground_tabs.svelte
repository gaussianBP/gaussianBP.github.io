<script>
    import { Tabs, TabList, TabPanel, Tab } from '../tabs/tabs.js';
    
  	import CustomPlayground from './custom_playground.svelte';
	import RobotLinear from './gbp2d_linear.svelte';
	import Robot from './robot.svelte';
	
</script>


<Tabs>
	<TabList>
		<Tab>Customizable</Tab>
		<Tab>Moving robot linear</Tab>
		<Tab>Moving robot non-linear</Tab>
		<Tab>Loop closure</Tab>
	</TabList>

	<TabPanel>
        <Robot/>
	</TabPanel>

	<TabPanel>
        <CustomPlayground/>
	</TabPanel>

	<TabPanel>
        <RobotLinear/>
	</TabPanel>
	


</Tabs>