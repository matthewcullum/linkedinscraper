/**
 * Created by matthew on 12/7/14.
 */


//chrome.tabs.create({url:'http://linkedin.com'});
//chrome.tabs.create({url:'http://gmail.com'});

var $form, $steps, $contents,
    domain, $form, $steps, $contents,
    tld, position_filter, company,
    companyIDs, skip_email_retrieval,
    $scrapeBtn;

var background = chrome.extension.getBackgroundPage();

// if a people object is present in memory, that means we've already run the scraping process
// rather than running it again, we'll just show the results
if (background.people.length) {
    show_step('results')
}
else {
    $(document).ready(function () {

        /****
         * Variable assignment
         */

            // get the company name and IDs from the URL
        company = helper.getParameterByName('company', location);
        companyIDs = helper.getParameterByName('companyID', location);
        $scrapeBtn = $('#scrape-link.btn-primary');
        $form = $('#options');
        $contents = $('#content');

        // Populate the page with the company name and IDs
        $('#company-name').append(company);
        $('#company-IDs').append(companyIDs);

        /******
         * Event listeners
         */

            // click handler for scrape button
        $scrapeBtn.click(function () {
            skip_email_retrieval = $('#skip-email-retrieval').is(':checked');
            var $self = $(this);
            position_filter = form_helper.format_position_filter($('#position-filter').val());
            domain = $('#domain').val();
            if (domain.length == 0) {
                alert("Domain cannot be empty");
                return;
            }
            domain += $('#tld').val();
            domain = '@' + domain;
            // if the button hasn't been clicked yet
            if ($self.hasClass('btn-primary')) {
                $self.removeClass('btn-primary').addClass('btn-danger').blur();
                start_scraping();
                $self.text('Cancel Scrape');
            }
            // the button has been clicked, which means it's now a cancel scrape button
            else {
                chrome.runtime.reload()
            }
        });
    });
}

// starts the scraper goes to next step when finished
function start_scraping() {

    show_step('scrape');

    var LinkedInHost = 'http://linkedin.com/';
    var advancedSearchPath = 'vsearch/';
    var scrape_url =
        LinkedInHost +
        advancedSearchPath +
        'p?title=' + position_filter +
        '&f_CC=' + companyIDs +
        '&openAdvancedForm=true&titleScope=C&locationType=I';

    background.scraper.start(scrape_url);

    var cycle = setInterval(function () {
        var $names_retrieved = $('#names-retrieved');
        $names_retrieved.text(background.people.length);
        if (!background.scraper.running()) {
            clearInterval(cycle);
            get_last_names();
        }
    }, 100)
}

function get_last_names() {

    show_step('last-name-retrieval');

    // yo backend - i need last names. NOW!
    background.last_names.start();

    // similar to a wife, this block will yap at the backend every 100ms asking if it's done
    var cycle = setInterval(function () {

        // note to self: change this names. Really bad var name to describe an html element
        var $names_retrieved = $('#names-retrieved');
        $names_retrieved.text(background.people.length);

        if (background.last_names.done()) {
            clearInterval(cycle);
            show_step('get-emails');
            // got email addresses?
            if (skip_email_retrieval) {
                show_step('results')
            }
            else {
                get_emails()
            }
        }
    }, 100)
}

function get_emails() {
    background.permuter.start(function () {
        background.email_checker.start(domain);
    });

    var cycle = setInterval(function () {

        if (background.email_checker.done()) {
            clearInterval(cycle);
            show_step('results')
        }
    }, 100)
}


/**
 * UI related
 * @param step
 */
function show_step(step) {
    if (step == 'results') {
        $('#start_csv_download').click(start_csv_download);
        $form.hide();
        $('#scrape-link').hide()
        $('.steps div').hide();
        $('#results').show();

        $('#im-done').click(function () {
            chrome.runtime.reload();
        })
    }
    else {
        var $current_step = $('#current-step');
        $current_step.show();

        hide_contents(function () {
            $form.hide();

            $steps = $('.steps div');
            $steps.hide();

            var $step = $('#' + step);
            $step.show('results');

            $current_step.text('Step ' + ($steps.index($step) + 1) + '/' + $steps.length)
        })
    }
}

/**
 * UI related
 * @param callback
 */
function hide_contents(callback) {
    $contents.slideUp(600, function () {
        callback();
        $contents.delay(100).slideDown(200)
    });
}

/**
 * Converts people object to CSV and invokes a download of the CSV file
 */
function start_csv_download() {
    var people = background.people;
    var csv = "";
    $.each(people, function (index, person) {
        var full_name = person.full_name;
        var email = person.email;
        var description = person.description;
        var dataString = [full_name, email, description];
        dataString = dataString.join(",");
        csv += index < people.length ? dataString + "\n" : dataString;
    });
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    pom.setAttribute('start_csv_download', 'results.csv');
    pom.click();
}

// just a few helpers for the form
var form_helper = {

    format_position_filter: function (title_filter) {
        var titles = title_filter.split(' ');
        var parsedString = '';
        for (var i = 0; i < titles.length; i++) {
            var currentTitle = titles[i];
            currentTitle = currentTitle.replace('.', '*');
            parsedString += currentTitle.toUpperCase();
            if ((i + 1) != titles.length) {
                parsedString += ' OR '
            }
        }
        return parsedString;
    }
};
