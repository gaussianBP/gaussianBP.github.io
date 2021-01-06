<script>
    import { Tabs, TabList, TabPanel, Tab } from '../tabs/tabs.js';
    
  	import CustomPlayground from './custom_playground.svelte';

</script>


<Tabs>
	<TabList>
		<Tab>Customizable</Tab>
		<Tab>Moving robot linear</Tab>
		<Tab>Moving robot non-linear</Tab>
		<Tab>Loop closure</Tab>
	</TabList>

	<TabPanel>
        <CustomPlayground/>
	</TabPanel>

	<TabPanel>
	</TabPanel>


</Tabs>