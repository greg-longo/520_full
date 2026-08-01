# DTSC 520 notebooks

The teaching notebooks for Modules 2, 3 and 4, in the form you work in them.

| Notebook | Module |
|---|---|
| `DTSC520_Module2_Python_STUDENT.ipynb` | 2 - Python |
| `DTSC520_Module3_NumPy_STUDENT.ipynb` | 3 - NumPy |
| `DTSC520_Module4_Pandas_STUDENT.ipynb` | 4 - pandas |

Each one is the same material as the module page on the site. The page is for
reading; the notebook is for running.

## Getting them running

Download the notebook **and the `data/` folder next to it**, keeping them in the
same place:

```
your-folder/
  DTSC520_Module4_Pandas_STUDENT.ipynb
  data/
    cohort_extract.csv
    ...
```

Then start Jupyter **from `your-folder`**, not from somewhere above it:

```
cd your-folder
jupyter lab
```

That last detail causes more first-week problems than anything else on this
list. `pd.read_csv("data/cohort_extract.csv")` looks for `data/` relative to
where Jupyter was started, not relative to where the notebook file sits. If you
get a `FileNotFoundError`, run this in a cell - it tells you where you actually
are:

```python
import os; print(os.getcwd())
```

## The exercises

Exercise cells read `### ENTER CODE HERE ###`. That is where your work goes.

Some cells are **meant to fail** - they are marked, and the error is the lesson.
Run them. An error you produced on purpose is the cheapest way to learn to read
one.

## The data

The cohort is **synthetic**. The hundred students, their names and their results
were generated for this course. Nothing in it describes a real person.

It is not, however, clean. That is deliberate, and Module 4 is largely about
what is wrong with it.

## If something breaks

- The site's [error translator](../help/index.html) explains the errors this
  course actually raises, in the course's own words.
- The [glossary](../glossary/index.html) defines every term the modules use.
- Still stuck: send the whole traceback and what you ran.
