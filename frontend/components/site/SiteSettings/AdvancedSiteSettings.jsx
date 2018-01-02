
import React from 'react';
import PropTypes from 'prop-types';
import { Field, reduxForm } from 'redux-form';

import SelectSiteEngine from '../../SelectSiteEngine';

const propTypes = {
  onDelete: PropTypes.func.isRequired,

  // initialValues is what the initial form values are based on
  initialValues: PropTypes.shape({
    engine: PropTypes.string.isRequired,
    config: PropTypes.string,
    demoConfig: PropTypes.string,
    previewConfig: PropTypes.string,
  }).isRequired,

  // the following props are from reduxForm:
  handleSubmit: PropTypes.func.isRequired,
  reset: PropTypes.func.isRequired,
  pristine: PropTypes.bool.isRequired,
};


export const AdvancedSiteSettings = ({
  // even though initialValues is not directly used, it is used
  // by reduxForm, and we want PropType validation on it, so we'll
  // keep it here but disable the eslint rule below
  initialValues, // eslint-disable-line no-unused-vars
  onDelete,
  reset,
  pristine,
  handleSubmit,
}) => (
  <form className="settings-form settings-form-advanced" onSubmit={handleSubmit}>
    <div className="well">
      <label htmlFor="engine">Static site engine</label>
      <Field
        name="engine"
        id="engine"
        component={p =>
          <SelectSiteEngine
            value={p.input.value}
            onChange={p.input.onChange}
            className="form-control"
          />
        }
      />

      {/* CUSTOM CONFIG */}
      <fieldset>
        <legend>Site configuration</legend>
        <p className="well-text">
          Add additional configuration in yaml to be added to your
          {' '}
          <code>_config.yml</code> file when we build your site&apos;s primary branch.
        </p>
        <Field
          component="textarea"
          name="config"
          className="form-control-mono"
        />
      </fieldset>

      {/* DEMO CONFIG */}
      <fieldset>
        <legend>Demo configuration</legend>
        <p className="well-text">
          Add additional configuration in yaml to be added to your
          {' '}
          <code>_config.yml</code> file when we build your site&apos;s demo branch.
        </p>
        <Field
          component="textarea"
          name="demoConfig"
          className="form-control-mono"
        />
      </fieldset>

      {/* PREVIEW CONFIG */}
      <fieldset>
        <legend>Preview configuration</legend>
        <p className="well-text">
          Add additional configuration in yaml to be added to your
          {' '}
          <code>_config.yml</code> file when we build a preview branch for your site.
        </p>
        <Field
          component="textarea"
          name="previewConfig"
          className="form-control-mono"
        />
      </fieldset>
      <button
        type="button"
        className="usa-button usa-button-gray button-reset"
        disabled={pristine}
        onClick={reset}
      >
        Reset
      </button>

      <button
        type="submit"
        className="usa-button usa-button-primary"
        disabled={pristine}
      >
        Save advanced settings
      </button>
    </div>


    <div className="usa-alert usa-alert-error usa-alert-delete" role="alert">
       <div className="usa-alert-body">
        <h3 className="usa-alert-heading">Danger zone</h3>
        <p className="usa-alert-text">Delete this site from Federalist?</p>
        <button
          className="usa-button usa-button-secondary button-delete"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  </form>
);


AdvancedSiteSettings.propTypes = propTypes;

// create a higher-order component with reduxForm and export that
export default reduxForm({ form: 'advancedSiteSettings' })(AdvancedSiteSettings);
