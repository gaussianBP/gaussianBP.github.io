<script>
  import EqualButtonGroup from '../utils/EqualButtonGroup.svelte'
  let brief = false;

  function handleChange(e) {
      brief = e.detail.value;
  }
</script>

<style>
    .box {
        border: 5px solid var(--blue);
        border-radius: 15px;
        background-color: var(--gray-bg);
        margin-bottom: 12px;
        padding-top: 8px;
        padding-left: 15px;
        padding-right: 15px;
    }

    #button-div {
        display: flex;
        justify-content: center;
        align-items: center;
        padding-top: 10px;
        padding-bottom: 10px;
    }

    .details {
        margin-top: -10px;
        line-height: 18px;
        font-size: 15px;
    }

    .property {
        font-size: 18px;
    }

</style>

<div class="box">

    <div id="button-div">
        <EqualButtonGroup options={[{ id: 0, name: 'Brief' }, { id: 1, name: 'Detailed' }]} labelTitle="" selected={brief} on:change={handleChange}/>
    </div>

    <ol>
        <li>
            <span class="property"><b>Local</b></span> - can operate with distributed processing and storage and message passing.
        </li>
        {#if brief}
            <ul class="details">
            <li>
                GBP can leverage any extra available compute whether on a single chip or distributed. 
            </li>
            <li>
                GBP naturally exploits any structure in the problem as communication is only between conditionally dependent nodes. 
            </li>
            <li>
                GBP can operate via "just in time" convergence <d-cite key="Davison:Ortiz:ARXIV2019"></d-cite> focusing compute on task-relevant regions - this is also attractive from an energy consumption perspective.
            </li>
            </ul>
        {/if}

        <li>
            <span class="property"><b>Probabilistic</b></span> - estimates uncertainties.
        </li>
        
        <li>
            <span class="property"><b>Iterative and convergent</b></span> - is not run over a fixed number of steps.
        </li>
        {#if brief}
            <ul class="details">
            <li>
                GBP can be run continually in the background and as new data arrives, the problem can be arbitrarily edited without interrupting inference. 
            </li>
            </ul>
        {/if}

        <li>
            <span class="property"><b>Asynchronous</b></span> - convergence can be reached via asynchronous updates.
        </li>
        {#if brief}
            <ul class="details">
            <li>
                This is important in distributed systems without a global clock or where communication delays are non-negligible such as in edge computing.
            </li>
            </ul>
        {/if}

    </ol>

</div>  