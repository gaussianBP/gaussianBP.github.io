<script>
    export let titleText;
    export let subtitleText;
</script>

<style>

    #title {
        font-weight: 700;
        font-size: 20px;
        margin-bottom: 0.25em;
        /* text-transform: uppercase */
        /* color: var(--orange); */
    }

    #subtitle {
        margin-bottom: 1em;
        color: var(--gray);
        line-height: 1.4em;
    }

    div {
        text-align: center
    }

</style>

<div>
    <div id="title">{titleText}</div>
    <div id="subtitle">{subtitleText}</div>
</div>