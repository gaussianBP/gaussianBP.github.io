<script>
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();
	
	// export let labelTitle = 'button label';
	export let options = []
	export let selected = 0
	
	function setSelected(e){
		const newValue = Number(e.target.value)
		
		selected = newValue
		
		dispatch('change', {value: newValue})
	}
</script>

<style>


    /* #text-label { */
        /* text-align: center; */
    /* } */

    button {
        padding: 0.5em 0.7em;
        text-align: center;
        font-size: 1em;
        color: black;
        background-color: Transparent;
        border-radius: 4px;
        width: fit-content
    }

	button.selected {
        background-color: var(--green);
	}

    #button-group {
        border: 1px solid green; /* Green border */
        background-color:  rgba(0, 0, 0, 0.1);
        border-radius: var(--border-radius);
        float: left; 
        margin-left: 5px;
        margin-right: 5px;
    }

</style>

<div id="buttons-wrapper">
    <!-- <label id="text-label">
        {labelTitle}
    </label> -->
    <div id="button-group">
        {#each options as option, index}
            <button 
                class="button" 
                class:selected={Number(selected) == option.id} 
                value={option.id}
                name={option.name}
                on:click={setSelected}>
                    {option.name}
            </button>
        {/each}
    </div>
</div>