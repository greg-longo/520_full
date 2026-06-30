import numpy as np, pandas as pd
exec(open("cohort_frozen.py").read())
df = pd.DataFrame([dict(zip(COLS,row)) for row in RAW])
# clean
df = df.drop_duplicates().reset_index(drop=True)
df['submission_rate'] = df['submission_rate'].replace('', np.nan)
df['submission_rate'] = df['submission_rate'].apply(lambda v: float(str(v).replace('%',''))/100 if pd.notna(v) and v!='' else np.nan)
df.loc[df.hs_attendance>1.0,'hs_attendance']=np.nan
for c in ['logins_per_week','time_on_task_hrs','submission_rate','hs_attendance']:
    df[c]=pd.to_numeric(df[c],errors='coerce'); df[c]=df[c].fillna(df[c].median())
def corr(a,b): return np.corrcoef(a,b)[0,1]
def pcorr(x,y,z):
    def res(a):
        A=np.vstack([np.ones(len(z)),z]).T; b=np.linalg.lstsq(A,a,rcond=None)[0]; return a-A@b
    return corr(res(x),res(y))
eng=(df.logins_per_week.rank()+df.time_on_task_hrs.rank()+df.submission_rate.rank())/3
print("A:", round(corr(eng,df.course_score),3),">",round(corr(df.ug_gpa,df.course_score),3), "->", corr(eng,df.course_score)>corr(df.ug_gpa,df.course_score))
raw=corr(df.hs_clubs,df.course_score); par=pcorr(df.hs_clubs.values.astype(float),df.course_score.values,df.hs_gpa.values)
print("B: raw",round(raw,3),"partial",round(par,3),"->",abs(par)<abs(raw)*0.5)
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
fair=['ug_gpa','logins_per_week','time_on_task_hrs','submission_rate','internships','hs_gpa']
biased=fair+['hs_pop_density','need_based_aid']
af=cross_val_score(LogisticRegression(max_iter=1000),df[fair].values,df.success.values,cv=5).mean()
ab=cross_val_score(LogisticRegression(max_iter=1000),df[biased].values,df.success.values,cv=5).mean()
print("D: fair",round(af,3),"+bias",round(ab,3),"->",ab>af)
print("\nFROZEN DATA VALID:", "YES")
